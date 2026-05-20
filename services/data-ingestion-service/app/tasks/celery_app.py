import os

from celery import Celery

BROKER_URL = os.environ.get("CELERY_BROKER_URL", "redis://localhost:6379/0")
RESULT_BACKEND = os.environ.get("CELERY_RESULT_BACKEND", "redis://localhost:6379/1")


def make_celery() -> Celery:
    celery = Celery(
        "nocode_ingestion",
        broker=BROKER_URL,
        backend=RESULT_BACKEND,
        include=[
            "app.tasks.profiling",
            "app.tasks.preprocessing",
            "app.tasks.sql_import",
            "app.tasks.rag_ingest",
            "app.tasks.image_extract",
        ],
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
            "app.tasks.rag_ingest.*": {"queue": "rag"},
            # Image extraction is CPU+IO bound and short-lived per file;
            # routed to the existing ingestion queue so we don't spin up a
            # fourth worker just for unzips.
            "app.tasks.image_extract.*": {"queue": "ingestion"},
        },
    )
    return celery


celery = make_celery()
