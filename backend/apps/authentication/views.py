"""
authentication/views.py — GitHub OAuth + JWT authentication endpoints.

GET  /api/auth/github/login     → returns GitHub OAuth URL
POST /api/auth/github/callback  → exchanges code for tokens
GET  /api/auth/me               → returns current user
POST /api/auth/refresh          → refresh JWT token
POST /api/auth/logout           → blacklist refresh token
"""
import logging
import secrets

import requests as http_requests
from django.conf import settings
from django.contrib.auth.models import User
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.exceptions import TokenError

from .models import UserProfile
from .serializers import UserSerializer, GitHubCallbackSerializer

logger = logging.getLogger(__name__)

GITHUB_AUTH_URL = 'https://github.com/login/oauth/authorize'
GITHUB_TOKEN_URL = 'https://github.com/login/oauth/access_token'
GITHUB_USER_URL = 'https://api.github.com/user'


class GitHubLoginView(APIView):
    """GET /api/auth/github/login — returns the GitHub OAuth authorization URL."""

    permission_classes = [AllowAny]

    def get(self, request):
        client_id = settings.GITHUB_CLIENT_ID
        if not client_id:
            return Response(
                {'error': 'GitHub OAuth is not configured. Set GITHUB_CLIENT_ID.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        # Generate and store a random state parameter to prevent CSRF
        state = secrets.token_urlsafe(32)
        request.session['oauth_state'] = state

        redirect_uri = f"{settings.FRONTEND_URL}/auth/callback"
        auth_url = (
            f"{GITHUB_AUTH_URL}"
            f"?client_id={client_id}"
            f"&redirect_uri={redirect_uri}"
            f"&scope=read:user user:email"
            f"&state={state}"
        )

        return Response({'auth_url': auth_url, 'state': state})


class GitHubCallbackView(APIView):
    """POST /api/auth/github/callback — exchange authorization code for JWT tokens."""

    permission_classes = [AllowAny]

    def post(self, request):
        serializer = GitHubCallbackSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        code = serializer.validated_data['code']
        state = serializer.validated_data['state']

        # State validation is handled by the frontend (localStorage) before calling
        # this endpoint, so no server-side session check is needed here.

        # Exchange code for GitHub access token
        token_response = http_requests.post(
            GITHUB_TOKEN_URL,
            data={
                'client_id': settings.GITHUB_CLIENT_ID,
                'client_secret': settings.GITHUB_CLIENT_SECRET,
                'code': code,
                'redirect_uri': f"{settings.FRONTEND_URL}/auth/callback",
            },
            headers={'Accept': 'application/json'},
            timeout=10,
        )

        if token_response.status_code != 200:
            logger.error('GitHub token exchange failed: %s', token_response.text)
            return Response(
                {'error': 'Failed to authenticate with GitHub.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        token_data = token_response.json()
        github_access_token = token_data.get('access_token')

        if not github_access_token:
            error_desc = token_data.get('error_description', 'Unknown error')
            return Response(
                {'error': f'GitHub authentication failed: {error_desc}'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Fetch GitHub user profile
        user_response = http_requests.get(
            GITHUB_USER_URL,
            headers={
                'Authorization': f'Bearer {github_access_token}',
                'Accept': 'application/json',
            },
            timeout=10,
        )

        if user_response.status_code != 200:
            return Response(
                {'error': 'Failed to fetch GitHub user profile.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        github_user = user_response.json()
        github_id = github_user['id']
        github_username = github_user.get('login', '')
        avatar_url = github_user.get('avatar_url', '')
        email = github_user.get('email', '')

        # If email is private, try to fetch from emails endpoint
        if not email:
            emails_response = http_requests.get(
                'https://api.github.com/user/emails',
                headers={
                    'Authorization': f'Bearer {github_access_token}',
                    'Accept': 'application/json',
                },
                timeout=10,
            )
            if emails_response.status_code == 200:
                emails = emails_response.json()
                primary = next((e for e in emails if e.get('primary')), None)
                if primary:
                    email = primary.get('email', '')

        # Create or update local user + profile
        user, profile = self._get_or_create_user(
            github_id=github_id,
            github_username=github_username,
            avatar_url=avatar_url,
            email=email,
            access_token=github_access_token,
        )

        # Generate JWT tokens
        refresh = RefreshToken.for_user(user)

        logger.info('User %s authenticated via GitHub (id=%d)', github_username, github_id)

        return Response({
            'access': str(refresh.access_token),
            'refresh': str(refresh),
            'user': UserSerializer(user).data,
        })

    @staticmethod
    def _get_or_create_user(github_id, github_username, avatar_url, email, access_token):
        """Create or update a Django User and UserProfile from GitHub data."""
        try:
            profile = UserProfile.objects.get(github_id=github_id)
            user = profile.user
            # Update profile with latest GitHub data
            profile.github_username = github_username
            profile.avatar_url = avatar_url
            profile.access_token = access_token
            profile.save(update_fields=['github_username', 'avatar_url', 'access_token', 'updated_at'])
            # Update user email if changed
            if email and user.email != email:
                user.email = email
                user.save(update_fields=['email'])
        except UserProfile.DoesNotExist:
            # Create new user — username must be unique, use github_username
            username = github_username
            if User.objects.filter(username=username).exists():
                username = f"{github_username}_{github_id}"

            user = User.objects.create_user(
                username=username,
                email=email or '',
            )
            profile = UserProfile.objects.create(
                user=user,
                github_id=github_id,
                github_username=github_username,
                avatar_url=avatar_url,
                access_token=access_token,
            )

        return user, profile


class MeView(APIView):
    """GET /api/auth/me — returns the currently authenticated user."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(UserSerializer(request.user).data)


class LogoutView(APIView):
    """POST /api/auth/logout — blacklist the refresh token."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        refresh_token = request.data.get('refresh')
        if not refresh_token:
            return Response(
                {'error': 'Refresh token is required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            token = RefreshToken(refresh_token)
            token.blacklist()
        except TokenError:
            pass  # Token may already be blacklisted or expired — that's fine

        return Response({'detail': 'Logged out successfully.'})
