from rest_framework import serializers
from .models import Repository


class RepositorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Repository
        fields = [
            'id', 'name', 'github_url', 'status', 'error_message',
            'file_count', 'chunk_count', 'summary', 'tech_stack',
            'languages', 'important_components', 'learning_path',
            'architecture_diagram', 'folder_structure', 'created_at', 'updated_at',
        ]
        read_only_fields = fields


class RepositoryAnalyzeSerializer(serializers.Serializer):
    github_url = serializers.URLField()

    def validate_github_url(self, value: str) -> str:
        value = value.rstrip('/')
        if 'github.com' not in value:
            raise serializers.ValidationError("Only GitHub URLs are supported.")
        parts = value.replace('https://github.com/', '').replace('http://github.com/', '').split('/')
        if len(parts) < 2:
            raise serializers.ValidationError(
                "URL must point to a repository, e.g. https://github.com/owner/repo"
            )
        return value


class RepositoryListSerializer(serializers.ModelSerializer):
    class Meta:
        model = Repository
        fields = ['id', 'name', 'github_url', 'status', 'file_count', 'chunk_count', 'created_at']
