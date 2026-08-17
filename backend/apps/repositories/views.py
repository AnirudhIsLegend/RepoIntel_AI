"""
repositories/views.py — Repository management endpoints.

POST /api/repositories/analyze       → clone + index via Celery task
GET  /api/repositories/              → list all repositories
GET  /api/repositories/{id}/         → full repository detail
DELETE /api/repositories/{id}/       → delete repo + vectors
GET  /api/repositories/{id}/architecture/ → architecture diagram
GET  /api/repositories/{id}/stream/  → SSE stream for indexing progress
"""
import json
import logging
import time

from django.conf import settings
from django.http import StreamingHttpResponse
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.authentication.throttles import (
    AnalyzeRepositoryThrottle,
    ArchitectureThrottle,
    RepositoryOverviewThrottle,
)
from .models import Repository, RepositoryFile
from .serializers import RepositorySerializer, RepositoryAnalyzeSerializer, RepositoryListSerializer
from .services import overview_service
from .services.mermaid_utils import sanitize_mermaid_diagram
from .services import vector_store
from .tasks import process_repository

logger = logging.getLogger(__name__)


# ─── Helpers ─────────────────────────────────────────────────────────────────

def _extract_repo_name(github_url: str) -> str:
    """Extract 'owner/repo' name from a GitHub URL."""
    url = github_url.rstrip('/')
    parts = url.split('github.com/')
    if len(parts) > 1:
        return parts[1]
    return url.split('/')[-1]


def _dispatch_task(repo: Repository, github_url: str) -> None:
    """Dispatch the Celery indexing task and store the task ID on the repo."""
    task = process_repository.delay(repo.id, github_url)
    repo.celery_task_id = task.id
    repo.save(update_fields=['celery_task_id'])
    logger.info('Dispatched Celery task %s for repo %d', task.id, repo.id)


# ─── Views ───────────────────────────────────────────────────────────────────

class RepositoryListView(APIView):
    """GET /api/repositories/ — list all repos."""

    throttle_classes = [RepositoryOverviewThrottle]

    def get(self, request):
        repos = Repository.objects.all()
        return Response(RepositoryListSerializer(repos, many=True).data)


class RepositoryAnalyzeView(APIView):
    """POST /api/repositories/analyze — start indexing a new repo."""

    throttle_classes = [AnalyzeRepositoryThrottle]

    def post(self, request):
        serializer = RepositoryAnalyzeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        github_url = serializer.validated_data['github_url']

        # Return existing if already indexed or still processing
        existing = Repository.objects.filter(github_url=github_url).first()
        if existing:
            if existing.status == 'error':
                # Re-trigger indexing for failed repos
                existing.status = 'pending'
                existing.error_message = ''
                existing.save(update_fields=['status', 'error_message'])
                _dispatch_task(existing, github_url)
                return Response(RepositorySerializer(existing).data)
            if existing.status == 'ready':
                return Response(RepositorySerializer(existing).data)
            # Still processing — return current state
            return Response(RepositorySerializer(existing).data)

        name = _extract_repo_name(github_url)
        repo = Repository.objects.create(name=name, github_url=github_url, status='pending')
        _dispatch_task(repo, github_url)

        return Response(RepositorySerializer(repo).data, status=status.HTTP_201_CREATED)


class RepositoryDetailView(APIView):
    """GET/DELETE /api/repositories/{id}/ — repository detail and deletion."""

    throttle_classes = [RepositoryOverviewThrottle]

    def get(self, request, pk: int):
        try:
            repo = Repository.objects.get(pk=pk)
        except Repository.DoesNotExist:
            return Response({'error': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        return Response(RepositorySerializer(repo).data)

    def delete(self, request, pk: int):
        try:
            repo = Repository.objects.get(pk=pk)
        except Repository.DoesNotExist:
            return Response({'error': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)

        # Remove vectors from Qdrant Cloud
        try:
            vector_store.delete_collection(repo.id)
        except Exception as exc:
            logger.warning('Failed to delete Qdrant collection for repo %d: %s', pk, exc)

        repo.delete()
        logger.info('Deleted repository %d', pk)
        return Response(status=status.HTTP_204_NO_CONTENT)


class RepositoryArchitectureView(APIView):
    """GET /api/repositories/{id}/architecture/ — architecture diagram + folder tree."""

    throttle_classes = [ArchitectureThrottle]

    def get(self, request, pk: int):
        try:
            repo = Repository.objects.get(pk=pk)
        except Repository.DoesNotExist:
            return Response({'error': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)

        return Response({
            'architecture_diagram': sanitize_mermaid_diagram(repo.architecture_diagram),
            'folder_structure':     repo.folder_structure,
            'important_components': repo.important_components,
            'tech_stack':           repo.tech_stack,
        })


class RepositoryStatusStreamView(APIView):
    """
    GET /api/repositories/{id}/stream/ — Server-Sent Events stream.

    Emits JSON status updates every second until the repository reaches
    'ready' or 'error'.  The frontend replaces setInterval polling with
    an EventSource connection to this endpoint.

    Authentication: JWT token passed as ?token= query param (SSE does not
    support custom request headers from browser EventSource).
    """

    # SSE is read-only so we relax the permission check to allow the
    # query-param token; the view manually validates it.
    permission_classes = []
    authentication_classes = []

    def get(self, request, pk: int):
        # Manual JWT validation via query param (browsers can't set headers on EventSource)
        from rest_framework_simplejwt.tokens import AccessToken
        from rest_framework_simplejwt.exceptions import TokenError

        token_str = request.GET.get('token', '')
        if not token_str:
            return Response({'error': 'Authentication required.'}, status=status.HTTP_401_UNAUTHORIZED)

        try:
            AccessToken(token_str)  # Validates and raises on invalid/expired
        except TokenError as exc:
            return Response({'error': str(exc)}, status=status.HTTP_401_UNAUTHORIZED)

        try:
            # Validate repo exists
            Repository.objects.get(pk=pk)
        except Repository.DoesNotExist:
            return Response({'error': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)

        def event_stream():
            """Generator that yields SSE-formatted status updates."""
            terminal_statuses = {'ready', 'error'}
            poll_interval = 1.0  # seconds between DB polls
            max_duration = 1800  # 30 minutes max stream duration

            elapsed = 0.0
            while elapsed < max_duration:
                try:
                    repo = Repository.objects.get(pk=pk)
                    payload = {
                        'id': repo.id,
                        'status': repo.status,
                        'error_message': repo.error_message,
                        'file_count': repo.file_count,
                        'chunk_count': repo.chunk_count,
                    }
                    yield f'data: {json.dumps(payload)}\n\n'

                    if repo.status in terminal_statuses:
                        break
                except Repository.DoesNotExist:
                    yield f'data: {json.dumps({"error": "Repository deleted"})}\n\n'
                    break
                except Exception as exc:
                    logger.error('SSE stream error for repo %d: %s', pk, exc)
                    break

                time.sleep(poll_interval)
                elapsed += poll_interval

        response = StreamingHttpResponse(event_stream(), content_type='text/event-stream')
        response['Cache-Control'] = 'no-cache'
        response['X-Accel-Buffering'] = 'no'  # Disable Nginx buffering
        return response
