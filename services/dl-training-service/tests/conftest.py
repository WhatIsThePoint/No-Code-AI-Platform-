"""Shared fixtures.

Only test-environment shimming lives here — fixtures that mutate global
state (env vars, the Mongo singleton) so individual tests can stay
declarative.
"""

from __future__ import annotations

import os

import pytest


@pytest.fixture(autouse=True)
def _testing_env(monkeypatch):
    """Force `FLASK_ENV=testing` so `create_app()` picks `TestingConfig`.

    Autouse because every test needs it and forgetting one would silently
    pull the production Mongo URL from the developer's shell.
    """
    monkeypatch.setenv("FLASK_ENV", "testing")
    # Required by Config — `create_app` reads it before TestingConfig
    # overrides MONGO_DB. Any string works for unit tests; the in-memory
    # fake collections never see this URL.
    monkeypatch.setenv(
        "MONGO_URL",
        os.environ.get("MONGO_URL", "mongodb://test:test@localhost:27017/test?authSource=admin"),
    )
    yield
