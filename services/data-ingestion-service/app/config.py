import os


class Config:
    MONGO_URL = os.environ["MONGO_URL"]
    MONGO_DB = os.environ.get("MONGO_DB", "nocode_ingestion")
    REDIS_URL = os.environ.get("REDIS_URL", "redis://localhost:6379/0")
    CELERY_BROKER_URL = os.environ.get("CELERY_BROKER_URL", "redis://localhost:6379/0")
    CELERY_RESULT_BACKEND = os.environ.get(
        "CELERY_RESULT_BACKEND", "redis://localhost:6379/1"
    )
    UPLOAD_FOLDER = os.environ.get("UPLOAD_FOLDER", "/uploads")
    MAX_UPLOAD_BYTES = int(os.environ.get("MAX_UPLOAD_SIZE_MB", 100)) * 1024 * 1024
    # DL image datasets are extracted under this root: <dataset_id>/<class>/<file>.
    # Lives on the same shared volume as UPLOAD_FOLDER so dl-training-service
    # can read it without a separate bind-mount.
    IMAGE_DATASET_ROOT = os.environ.get("IMAGE_DATASET_ROOT", "/uploads/images")
    # Image-zip uploads are larger than tabular CSVs; default 500 MB.
    MAX_IMAGE_UPLOAD_BYTES = int(os.environ.get("MAX_IMAGE_UPLOAD_SIZE_MB", 500)) * 1024 * 1024
    FERNET_KEY = os.environ.get("FERNET_KEY", "")
    PREVIEW_CACHE_TTL = 3600  # seconds


class TestingConfig(Config):
    TESTING = True
    MONGO_URL = os.environ.get(
        "MONGO_URL",
        "mongodb://test:test@localhost:27017/test_ingestion?authSource=admin",
    )
    MONGO_DB = "test_ingestion"
