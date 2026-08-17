from django.db import models


class Repository(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('cloning', 'Cloning'),
        ('parsing', 'Parsing'),
        ('indexing', 'Indexing'),
        ('generating_overview', 'Generating Overview'),
        ('ready', 'Ready'),
        ('error', 'Error'),
    ]

    name = models.CharField(max_length=255)
    github_url = models.URLField(unique=True, max_length=512)
    status = models.CharField(max_length=30, choices=STATUS_CHOICES, default='pending')
    error_message = models.TextField(blank=True)

    # Indexing stats
    file_count = models.IntegerField(default=0)
    chunk_count = models.IntegerField(default=0)

    # Overview data (populated after indexing)
    summary = models.TextField(blank=True)
    tech_stack = models.JSONField(default=dict)
    languages = models.JSONField(default=list)
    important_components = models.JSONField(default=list)
    learning_path = models.JSONField(default=list)
    architecture_diagram = models.TextField(blank=True)
    folder_structure = models.TextField(blank=True)

    # Celery task ID for the active indexing job (blank when not processing)
    celery_task_id = models.CharField(max_length=255, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name_plural = 'repositories'

    def __str__(self):
        return f"{self.name} ({self.status})"


class RepositoryFile(models.Model):
    repository = models.ForeignKey(Repository, on_delete=models.CASCADE, related_name='files')
    path = models.CharField(max_length=1024)
    content = models.TextField()
    language = models.CharField(max_length=50, blank=True)

    class Meta:
        unique_together = ['repository', 'path']

    def __str__(self):
        return f"{self.repository.name}/{self.path}"


class CodeChunk(models.Model):
    repository = models.ForeignKey(Repository, on_delete=models.CASCADE, related_name='chunks')
    file_path = models.CharField(max_length=1024)
    chunk_text = models.TextField()
    chunk_index = models.IntegerField(default=0)

    class Meta:
        ordering = ['file_path', 'chunk_index']

    def __str__(self):
        return f"{self.file_path}[{self.chunk_index}]"
