import os
import tempfile


class Config:
    MONGO_URL = os.environ.get(
        "MONGO_URL",
        "mongodb://nocode:nocode_secret@localhost:27017/nocode_ingestion?authSource=admin",
    )
    MONGO_DB = os.environ.get("MONGO_DB", "nocode_ingestion")
    REDIS_URL = os.environ.get("REDIS_URL", "redis://localhost:6379/0")
    CELERY_BROKER_URL = os.environ.get("CELERY_BROKER_URL", "redis://localhost:6379/0")
    CELERY_RESULT_BACKEND = os.environ.get(
        "CELERY_RESULT_BACKEND", "redis://localhost:6379/1"
    )
    SOCKETIO_MESSAGE_QUEUE = os.environ.get(
        "SOCKETIO_MESSAGE_QUEUE", "redis://localhost:6379/2"
    )

    # Storage roots are shared volumes mounted from the host so other services
    # (api-gateway downloads, model-registry) can stream the artefacts back out.
    UPLOAD_FOLDER = os.environ.get("UPLOAD_FOLDER", "/uploads")
    MODEL_FOLDER = os.environ.get("MODEL_FOLDER", "/models")
    IMAGE_DATASET_ROOT = os.environ.get("IMAGE_DATASET_ROOT", "/uploads/images")

    # VRAM ceiling used by vram_guard when no per-user override is set. The
    # 1660 Super has 6 GB; we reserve 1 GB headroom for the OS / driver and
    # cap at 5120 MB so a runaway batch can't OOM the card mid-demo.
    DEFAULT_MAX_VRAM_MB = int(os.environ.get("DEFAULT_MAX_VRAM_MB", "5120"))

    # Hard caps that *no* tier override can exceed — these protect the host,
    # not the tenant. See vram_guard.estimate() for the static memory model.
    HARD_MAX_EPOCHS = int(os.environ.get("HARD_MAX_EPOCHS", "20"))
    HARD_MAX_BATCH_SIZE = int(os.environ.get("HARD_MAX_BATCH_SIZE", "64"))


class TestingConfig(Config):
    TESTING = True
    MONGO_DB = "test_dl_training"
    MODEL_FOLDER = tempfile.mkdtemp()
    IMAGE_DATASET_ROOT = tempfile.mkdtemp()
