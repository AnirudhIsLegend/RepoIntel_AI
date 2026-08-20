#!/bin/bash
# ── Render Celery Worker Start Script ────────────────────────────────────────
# Use this as the start command for the Render Background Worker service.
#
# It runs Django migrations first (so django_celery_results tables exist)
# and then starts the Celery worker.
set -e

echo "=== Running database migrations ==="
python manage.py migrate --noinput

echo "=== Starting Celery worker ==="
exec celery -A config worker --loglevel=info --concurrency=1
