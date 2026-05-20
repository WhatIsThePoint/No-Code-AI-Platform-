import os

from celery import Celery

BROKER_URL = os.environ.get("CELERY_BROKER_URL", "redis://localhost:6379/0")
RESULT_BACKEND = os.environ.get("CELERY_RESULT_BACKEND", "redis://localhost:6379/1")


def make_celery() -> Celery:
    celery = Celery(
        "nocode_dl_training",
        broker=BROKER_URL,
        backend=RESULT_BACKEND,
    )
    celery.conf.update(
        task_serializer="json",
        result_serializer="json",
        accept_content=["json"],
        task_track_started=True,
        task_acks_late=True,
        # GPU work is heavy and per-task — never let one worker prefetch the
        # next batch into memory, that's how a single bad job knocks the
        # second one out with OOM before the first has even released VRAM.
        worker_prefetch_multiplier=1,
        # All DL tasks land on a dedicated `dl_training` queue so an in-flight
        # 20-epoch run can't starve the fast XGBoost queue handled by the
        # ml-training-worker (and vice versa).
        task_routes={
            "app.tasks.train_image.*": {"queue": "dl_training"},
        },
    )
    # Eager-import task modules so Celery's autodiscovery picks up the
    # decorated functions without needing every worker entrypoint to know
    # the module path.
    celery.autodiscover_tasks(["app.tasks"], force=True)
    return celery


celery = make_celery()
