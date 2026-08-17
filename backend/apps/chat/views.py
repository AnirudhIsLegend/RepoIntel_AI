"""
chat/views.py — RAG chat endpoints.

POST /api/chat/                   → ask a question about a repository
GET  /api/chat/history/{repo_id}/ → retrieve chat history
"""
import logging

from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.authentication.throttles import ChatThrottle
from apps.repositories.models import Repository
from .models import ChatSession, ChatMessage
from .serializers import ChatInputSerializer, ChatSessionSerializer, ChatMessageSerializer
from .services.rag_service import chat_with_repository

logger = logging.getLogger(__name__)


class ChatView(APIView):
    """POST /api/chat/ — answer a developer question using RAG."""

    throttle_classes = [ChatThrottle]

    def post(self, request):
        serializer = ChatInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        repo_id = serializer.validated_data['repository_id']
        question = serializer.validated_data['question']
        session_id = serializer.validated_data.get('session_id')

        # Validate repository exists and is ready
        try:
            repo = Repository.objects.get(pk=repo_id)
        except Repository.DoesNotExist:
            return Response({'error': 'Repository not found.'}, status=status.HTTP_404_NOT_FOUND)

        if repo.status != 'ready':
            return Response(
                {'error': f'Repository is not ready yet. Current status: {repo.status}'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Get or create chat session
        if session_id:
            session = ChatSession.objects.filter(pk=session_id, repository_id=repo_id).first()
            if not session:
                session = ChatSession.objects.create(repository=repo)
        else:
            # Reuse the most recent session or create a new one
            session = ChatSession.objects.filter(repository=repo).order_by('-created_at').first()
            if not session:
                session = ChatSession.objects.create(repository=repo)

        # Load recent history for context
        recent_messages = list(
            session.messages.order_by('-created_at')[:6].values('role', 'content')
        )
        recent_messages.reverse()

        # Save user message
        ChatMessage.objects.create(
            session=session,
            role='user',
            content=question,
        )

        # Run RAG
        result = chat_with_repository(repo_id, question, chat_history=recent_messages)

        # Save assistant message
        assistant_msg = ChatMessage.objects.create(
            session=session,
            role='assistant',
            content=result['answer'],
            sources=result['sources'],
            chunks=result['chunks'],
        )

        return Response({
            'session_id': session.id,
            'message':    ChatMessageSerializer(assistant_msg).data,
            'answer':     result['answer'],
            'sources':    result['sources'],
            'chunks':     result['chunks'],
        })


class ChatHistoryView(APIView):
    """GET /api/chat/history/{repo_id}/ — retrieve all chat messages for a repo."""

    def get(self, request, repo_id: int):
        sessions = ChatSession.objects.filter(repository_id=repo_id).prefetch_related('messages')
        serializer = ChatSessionSerializer(sessions, many=True)
        return Response(serializer.data)
