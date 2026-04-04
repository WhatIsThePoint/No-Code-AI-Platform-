import os
from unittest.mock import MagicMock, patch

import pytest

os.environ.setdefault(
    "MONGO_URL", "mongodb://test:test@localhost:27017/test_training?authSource=admin"
)
os.environ.setdefault("MONGO_DB", "test_training")
os.environ.setdefault("REDIS_URL", "redis://localhost:6379/0")
os.environ.setdefault("CELERY_BROKER_URL", "redis://localhost:6379/0")
os.environ.setdefault("CELERY_RESULT_BACKEND", "redis://localhost:6379/1")
os.environ.setdefault("FLASK_ENV", "testing")

from app.config import TestingConfig  # noqa: E402


@pytest.fixture(scope="session")
def app():
    # Patch mongo and mail on the main module where they are bound at import time
    with patch("app.main.mongo") as mock_mongo, patch("app.main.mail") as mock_mail:
        mock_mongo.init_app = MagicMock()
        mock_mongo.db = MagicMock()
        mock_mail.init_app = MagicMock()

        from app.main import create_app

        application = create_app(TestingConfig)
        yield application


@pytest.fixture
def client(app):
    return app.test_client()


USER_HEADERS = {"X-User-Id": "test-user-123", "X-User-Role": "data_scientist"}
