from rest_framework import serializers
from django.contrib.auth.models import User


class UserSerializer(serializers.ModelSerializer):
    """Serializes user info including GitHub profile data."""

    avatar_url = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'avatar_url']
        read_only_fields = fields

    def get_avatar_url(self, obj):
        profile = getattr(obj, 'profile', None)
        return profile.avatar_url if profile else ''


class GitHubCallbackSerializer(serializers.Serializer):
    """Validates the GitHub OAuth callback parameters."""

    code = serializers.CharField(required=True)
    state = serializers.CharField(required=True)
