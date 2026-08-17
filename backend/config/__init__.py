# config package

# Ensure the Celery app is always imported when Django starts so that
# shared_task and task discovery work correctly across all apps.
from .celery import app as celery_app

__all__ = ('celery_app',)
