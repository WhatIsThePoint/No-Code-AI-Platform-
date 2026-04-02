import os

import pytest

os.environ.setdefault("DATABASE_URL", "postgresql://test:test@localhost:5432/test_auth")
os.environ.setdefault("JWT_SECRET_KEY", "test-secret-key")
os.environ.setdefault("REDIS_URL", "redis://localhost:6379/0")
os.environ.setdefault("FLASK_ENV", "testing")

from app.config import TestingConfig
from app.extensions import db as _db
from app.main import create_app


@pytest.fixture(scope="session")
def app():
    application = create_app(TestingConfig)
    with application.app_context():
        _db.create_all()
        yield application
        _db.drop_all()


@pytest.fixture(scope="function")
def client(app):
    return app.test_client()


@pytest.fixture(autouse=True)
def clean_db(app):
    """Wrap each test in a transaction and roll back after."""
    with app.app_context():
        conn = _db.engine.connect()
        trans = conn.begin()
        _db.session.bind = conn
        yield
        _db.session.remove()
        trans.rollback()
        conn.close()
