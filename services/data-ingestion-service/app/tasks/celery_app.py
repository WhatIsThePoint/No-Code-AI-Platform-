import os

from celery import Celery

BROKER_URL = os.environ.get("CELERY_BROKER_URL", "redis://localhost:6379/0")
RESULT_BACKEND = os.environ.get("CELERY_RESULT_BACKEND", "redis://localhost:6379/1")


def make_celery() -> Celery:
    celery = Celery(
        "nocode_ingestion",
        broker=BROKER_URL,
        backend=RESULT_BACKEND,
    )
    celery.conf.update(
        task_serializer="json",
        result_serializer="json",
        accept_content=["json"],
        task_track_started=True,
        task_acks_late=True,
        worker_prefetch_multiplier=1,
        task_routes={
            "app.tasks.profiling.*": {"queue": "ingestion"},
            "app.tasks.preprocessing.*": {"queue": "ingestion"},
            "app.tasks.sql_import.*": {"queue": "connectors"},
        },
    )
    return celery


celery = make_celery()
