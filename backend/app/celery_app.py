from celery import Celery
from config import config
import os

# Get config for Celery setup
config_name = os.getenv('FLASK_ENV', 'development')
app_config = config[config_name]

# Create Celery app WITHOUT Flask app (avoid circular import)
celery = Celery(
    'chronosift',
    broker=app_config.CELERY_BROKER_URL,
    backend=app_config.CELERY_RESULT_BACKEND,
    include=['app.tasks.file_processing', 'app.tasks.llm_analysis_tasks']
)

celery.conf.update(
    task_serializer='json',
    accept_content=['json'],
    result_serializer='json',
    timezone='UTC',
    enable_utc=True,
    task_track_started=True,
    task_time_limit=3600,
    task_soft_time_limit=3300,
    worker_prefetch_multiplier=1,
    result_expires=86400,
    task_acks_late=True,
    task_reject_on_worker_lost=True,
    broker_connection_retry_on_startup=True,
)
