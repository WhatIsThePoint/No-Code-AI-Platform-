import io
import os
import tempfile

import pytest
from unittest.mock import patch, MagicMock

os.environ.setdefault("MONGO_URL", "mongodb://test:test@localhost:27017/test_ingestion?authSource=admin")
os.environ.setdefault("MONGO_DB", "test_ingestion")
os.environ.setdefault("REDIS_URL", "redis://localhost:6379/0")
os.environ.setdefault("CELERY_BROKER_URL", "redis://localhost:6379/0")
os.environ.setdefault("CELERY_RESULT_BACKEND", "redis://localhost:6379/1")
os.environ.setdefault("FERNET_KEY", "dGVzdC1mZXJuZXQta2V5LWZpbGwtMzItYnl0ZXMhIQ==")
os.environ.setdefault("FLASK_ENV", "testing")

from app.config import TestingConfig
from app.main import create_app


@pytest.fixture(scope="session")
def app():
    with tempfile.TemporaryDirectory() as tmpdir:
        TestingConfig.UPLOAD_FOLDER = tmpdir
        os.environ["UPLOAD_FOLDER"] = tmpdir

        # Patch Celery tasks to avoid actual Redis connections
        with patch("app.tasks.profiling.profile_dataset.apply_async") as mock_task:
            mock_task.return_value = MagicMock(id="test-task-id")
            application = create_app(TestingConfig)
            application.config["UPLOAD_FOLDER"] = tmpdir
            yield application


@pytest.fixture
def client(app):
    return app.test_client()


USER_HEADERS = {"X-User-Id": "test-user-123", "X-User-Role": "data_scientist"}
