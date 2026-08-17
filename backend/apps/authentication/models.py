from django.db import models
from django.contrib.auth.models import User


class UserProfile(models.Model):
    """Extended profile storing GitHub-specific information."""

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    github_id = models.IntegerField(unique=True)
    github_username = models.CharField(max_length=255)
    avatar_url = models.URLField(max_length=512, blank=True)
    access_token = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.github_username} (GitHub)"
