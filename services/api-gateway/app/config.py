import os
from datetime import timedelta


class Config:
    JWT_SECRET_KEY = os.environ["JWT_SECRET_KEY"]
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(
        seconds=int(os.environ.get("JWT_ACCESS_TOKEN_EXPIRES", 900))
    )
    JWT_TOKEN_LOCATION = ["headers"]
    JWT_HEADER_NAME = "Authorization"
    JWT_HEADER_TYPE = "Bearer"

    REDIS_URL = os.environ.get("REDIS_URL", "redis://localhost:6379/0")
    # SocketIO message queue (DB 2 — avoids Celery broker/result DBs 0/1)
    SOCKETIO_MESSAGE_QUEUE = os.environ.get(
        "SOCKETIO_MESSAGE_QUEUE", "redis://localhost:6379/2"
    )
    # Shared auth DB for chat persistence
    DATABASE_URL = os.environ.get(
        "DATABASE_URL",
        "postgresql://nocode:nocode_secret@localhost:5434/nocode_auth",
    )

    AUTH_SERVICE_URL = os.environ.get("AUTH_SERVICE_URL", "http://localhost:8001")
    DATA_SERVICE_URL = os.environ.get("DATA_SERVICE_URL", "http://localhost:8002")
    ML_SERVICE_URL = os.environ.get("ML_SERVICE_URL", "http://localhost:8003")
    METRICS_SERVICE_URL = os.environ.get("METRICS_SERVICE_URL", "http://localhost:8004")

    # Sprint 7 Module 4 — local AI companion
    OLLAMA_URL = os.environ.get("OLLAMA_URL", "http://ollama:11434")
    OLLAMA_MODEL = os.environ.get("OLLAMA_MODEL", "llama3.2:3b")

    # CORS
    CORS_ORIGINS = os.environ.get("CORS_ORIGINS", "http://localhost:5173").split(",")


class TestingConfig(Config):
    TESTING = True
    JWT_SECRET_KEY = os.environ.get("JWT_SECRET_KEY", "test-secret")
