from django.contrib import admin
from .models import Repository, RepositoryFile, CodeChunk


@admin.register(Repository)
class RepositoryAdmin(admin.ModelAdmin):
    list_display = ['name', 'github_url', 'status', 'file_count', 'chunk_count', 'created_at']
    list_filter = ['status']
    search_fields = ['name', 'github_url']
    readonly_fields = ['created_at', 'updated_at']


@admin.register(RepositoryFile)
class RepositoryFileAdmin(admin.ModelAdmin):
    list_display = ['path', 'language', 'repository']
    list_filter = ['language']


@admin.register(CodeChunk)
class CodeChunkAdmin(admin.ModelAdmin):
    list_display = ['file_path', 'chunk_index', 'repository']
