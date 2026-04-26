"""Sprint 7 Module 4 — POST /api/companion/ask."""

import os

import responses as resp_mock
from flask_jwt_extended import create_access_token

OLLAMA_BASE = os.environ.get("OLLAMA_URL", "http://ollama:11434").rstrip("/")


def _bearer(app, user_id="00000000-0000-0000-0000-000000000001"):
    with app.app_context():
        token = create_access_token(
            identity=user_id,
            additional_claims={"role": "data_scientist", "tier": "personal"},
        )
    return {"Authorization": f"Bearer {token}"}


def test_companion_requires_auth(client):
    resp = client.post("/api/companion/ask", json={"question": "hi"})
    assert resp.status_code == 401


def test_companion_rejects_empty_question(client, app):
    resp = client.post(
        "/api/companion/ask", headers=_bearer(app), json={"question": ""}
    )
    assert resp.status_code == 400
    assert resp.get_json()["error"] == "question_required"


@resp_mock.activate
def test_companion_proxies_to_ollama(client, app):
    resp_mock.add(
        resp_mock.POST,
        f"{OLLAMA_BASE}/api/generate",
        json={"response": "Open the dataset's profiling tab.", "done": True},
        status=200,
    )

    resp = client.post(
        "/api/companion/ask",
        headers=_bearer(app),
        json={
            "question": "Where do I see column distributions?",
            "context": {"active_view": "DatasetDetailPage"},
        },
    )
    assert resp.status_code == 200
    body = resp.get_json()
    assert "answer" in body
    assert body["answer"].startswith("Open the dataset")
    assert "model" in body
    assert "elapsed_ms" in body


@resp_mock.activate
def test_companion_503_when_ollama_unavailable(client, app):
    # No mock registered → connection error → 503 ollama_unavailable
    resp = client.post(
        "/api/companion/ask",
        headers=_bearer(app),
        json={"question": "what now?"},
    )
    assert resp.status_code == 503
    assert resp.get_json()["error"] == "ollama_unavailable"
