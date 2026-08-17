from django.urls import path
from . import views

urlpatterns = [
    path('repositories/', views.RepositoryListView.as_view(), name='repository-list'),
    path('repositories/analyze', views.RepositoryAnalyzeView.as_view(), name='repository-analyze'),
    path('repositories/<int:pk>/', views.RepositoryDetailView.as_view(), name='repository-detail'),
    path('repositories/<int:pk>/architecture/', views.RepositoryArchitectureView.as_view(), name='repository-architecture'),
    # SSE endpoint for real-time indexing progress (replaces polling)
    path('repositories/<int:pk>/stream/', views.RepositoryStatusStreamView.as_view(), name='repository-stream'),
]
