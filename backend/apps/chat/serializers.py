from rest_framework import serializers
from .models import ChatSession, ChatMessage


class ChatMessageSerializer(serializers.ModelSerializer):
    class Meta:
        model = ChatMessage
        fields = ['id', 'role', 'content', 'sources', 'chunks', 'created_at']
        read_only_fields = fields


class ChatSessionSerializer(serializers.ModelSerializer):
    messages = ChatMessageSerializer(many=True, read_only=True)

    class Meta:
        model = ChatSession
        fields = ['id', 'repository', 'created_at', 'messages']
        read_only_fields = fields


class ChatInputSerializer(serializers.Serializer):
    repository_id = serializers.IntegerField()
    question = serializers.CharField(min_length=1, max_length=2000)
    session_id = serializers.IntegerField(required=False, allow_null=True)
