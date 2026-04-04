import os

import pytest

os.environ.setdefault("JWT_SECRET_KEY", "test-secret-key")
os.environ.setdefault("REDIS_URL", "redis://localhost:6379/0")
os.environ.setdefault("AUTH_SERVICE_URL", "http://auth-service:8001")
os.environ.setdefault("DATA_SERVICE_URL", "http://data-service:8002")
os.environ.setdefault("ML_SERVICE_URL", "http://ml-service:8003")
os.environ.setdefault("METRICS_SERVICE_URL", "http://metrics-service:8004")
os.environ.setdefault("FLASK_ENV", "testing")

from app.config import TestingConfig  # noqa: E402
from app.main import create_app  # noqa: E402


@pytest.fixture(scope="session")
def app():
    application = create_app(TestingConfig)
    yield application


@pytest.fixture
def client(app):
    return app.test_client()
