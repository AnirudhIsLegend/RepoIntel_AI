"""
celery.py — Celery application configuration for RepoIntel AI.

Broker:  Redis (Upstash in production, local Redis in development)
Backend: django-celery-results (stores task state in PostgreSQL)
"""
import os

from celery import Celery

# Set the default Django settings module for the Celery CLI
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

app = Celery('repointel')

# Read configuration from Django settings, namespaced under CELERY_
app.config_from_object('django.conf:settings', namespace='CELERY')

# Auto-discover tasks in all installed Django apps
app.autodiscover_tasks()
