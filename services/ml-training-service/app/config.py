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
    UPLOAD_FOLDER = os.environ.get("UPLOAD_FOLDER", "/uploads")
    MODEL_FOLDER = os.environ.get("MODEL_FOLDER", "/models")

    # Flask-Mail
    MAIL_SERVER = os.environ.get("MAIL_SERVER", "mailhog")
    MAIL_PORT = int(os.environ.get("MAIL_PORT", 1025))
    MAIL_USE_TLS = os.environ.get("MAIL_USE_TLS", "false").lower() == "true"
    MAIL_USERNAME = os.environ.get("MAIL_USERNAME", "")
    MAIL_PASSWORD = os.environ.get("MAIL_PASSWORD", "")
    MAIL_DEFAULT_SENDER = os.environ.get(
        "MAIL_DEFAULT_SENDER", "noreply@nocode-ai.local"
    )
    FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:5173")


class TestingConfig(Config):
    TESTING = True
    MONGO_DB = "test_training"
    MODEL_FOLDER = tempfile.mkdtemp()
