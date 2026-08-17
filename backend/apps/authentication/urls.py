from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView

from . import views

urlpatterns = [
    path('auth/github/login', views.GitHubLoginView.as_view(), name='github-login'),
    path('auth/github/callback', views.GitHubCallbackView.as_view(), name='github-callback'),
    path('auth/me', views.MeView.as_view(), name='auth-me'),
    path('auth/refresh', TokenRefreshView.as_view(), name='token-refresh'),
    path('auth/logout', views.LogoutView.as_view(), name='auth-logout'),
]
