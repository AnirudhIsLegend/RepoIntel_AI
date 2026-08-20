"""
repositories/tasks.py — Celery tasks for repository ingestion.

Replaces the raw threading.Thread approach in views.py.

Task flow:
  1. Clone repository
  2. Parse files
  3. Generate embeddings → store in Qdrant
  4. Generate overview with Gemini
  5. Mark repository ready
  6. Delete cloned repo (always, even on failure)
"""
import logging

from celery import shared_task
from django.db import connection

from .services import git_service, indexing_service, overview_service
from .models import Repository, RepositoryFile

logger = logging.getLogger(__name__)


@shared_task(
    bind=True,
    max_retries=3,
    default_retry_delay=30,       # 30 s before first retry
    autoretry_for=(OSError,),     # Auto-retry on transient OS/network errors
    retry_backoff=True,           # Exponential backoff: 30s, 60s, 120s
    retry_backoff_max=300,        # Cap backoff at 5 minutes
    acks_late=True,               # Acknowledge only after task completes
    soft_time_limit=600,          # 10 min soft limit (raises SoftTimeLimitExceeded)
    time_limit=900,               # 15 min hard kill
    name='repositories.process_repository',
)
def process_repository(self, repo_id: int, github_url: str) -> dict:
    """
    Full repository ingestion pipeline as a Celery task.

    Args:
        repo_id:    Primary key of the Repository model instance.
        github_url: Public GitHub URL to clone.

    Returns a dict with final stats on success.
    Raises an exception on non-retryable failure (sets repo.status = 'error').
    """
    repo_path = None
    try:
        if not __import__('django.conf', fromlist=['settings']).settings.GOOGLE_API_KEY:
            raise ValueError('GOOGLE_API_KEY is not configured. Add it to backend/.env')

        repo = Repository.objects.get(id=repo_id)
        logger.info('[Task %s] Starting pipeline for repo %d (%s)', self.request.id, repo_id, github_url)

        # ── 1. Clone ──────────────────────────────────────────────────────────
        repo.status = 'cloning'
        repo.save(update_fields=['status'])
        repo_path = git_service.clone_repository(github_url, repo_id)
        logger.info('[Task %s] Cloned repo %d to %s', self.request.id, repo_id, repo_path)

        # ── 2. Parse ──────────────────────────────────────────────────────────
        repo.status = 'parsing'
        repo.save(update_fields=['status'])
        files = git_service.parse_repository(repo_path)
        folder_structure = git_service.get_folder_structure(repo_path)

        RepositoryFile.objects.filter(repository_id=repo_id).delete()
        RepositoryFile.objects.bulk_create([
            RepositoryFile(
                repository_id=repo_id,
                path=f['path'],
                content=f['content'],
                language=f['language'],
            )
            for f in files
        ])

        repo.file_count = len(files)
        repo.folder_structure = folder_structure
        repo.save(update_fields=['file_count', 'folder_structure'])
        logger.info('[Task %s] Parsed %d files for repo %d', self.request.id, len(files), repo_id)

        # ── 3. Index (embed + store in Qdrant) ────────────────────────────────
        repo.status = 'indexing'
        repo.save(update_fields=['status'])
        chunk_count = indexing_service.index_repository(repo_id, files)
        repo.chunk_count = chunk_count
        repo.save(update_fields=['chunk_count'])
        logger.info('[Task %s] Indexed %d chunks for repo %d', self.request.id, chunk_count, repo_id)

        # ── 4. Generate overview ──────────────────────────────────────────────
        repo.status = 'generating_overview'
        repo.save(update_fields=['status'])
        overview = overview_service.generate_overview(repo.name, files, folder_structure)

        repo.summary = overview.get('summary', '')
        repo.tech_stack = overview.get('tech_stack', {})
        repo.languages = overview.get('languages', [])
        repo.important_components = overview.get('important_components', [])
        repo.learning_path = overview.get('learning_path', [])
        repo.architecture_diagram = overview.get('architecture_diagram', '')
        repo.status = 'ready'
        repo.celery_task_id = ''
        repo.save()

        logger.info('[Task %s] Repository %d (%s) is ready.', self.request.id, repo_id, repo.name)

        return {
            'repo_id': repo_id,
            'status': 'ready',
            'file_count': repo.file_count,
            'chunk_count': chunk_count,
        }

    except Exception as exc:
        logger.exception('[Task %s] Error processing repository %d: %s', self.request.id, repo_id, exc)
        try:
            repo = Repository.objects.get(id=repo_id)
            repo.status = 'error'
            repo.error_message = str(exc)
            repo.celery_task_id = ''
            repo.save(update_fields=['status', 'error_message', 'celery_task_id'])
        except Exception:
            pass
        # Re-raise so Celery marks the task as FAILURE
        raise

    finally:
        # ── 5. Always clean up the cloned repo ────────────────────────────────
        if repo_path:
            git_service.cleanup_repository(repo_path)
            logger.info('[Task %s] Cleaned up cloned repo at %s', self.request.id, repo_path)
        # Close the DB connection — Celery workers run in a different thread
        connection.close()
