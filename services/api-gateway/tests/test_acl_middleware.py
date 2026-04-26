"""Sprint 6 — ACL middleware on /pipelines/*."""

import os

import responses as resp_mock
from flask_jwt_extended import create_access_token

# Resolve the real upstream URLs the gateway is configured with so the mock
# patterns match exactly. In the docker test env, ML_SERVICE_URL is set to
# `http://ml-training-service:8003` (not `ml-service`), so we must register
# mocks against the configured value.
ML_BASE = os.environ.get("ML_SERVICE_URL", "http://ml-service:8003").rstrip("/")
AUTH_BASE = os.environ.get("AUTH_SERVICE_URL", "http://auth-service:8001").rstrip("/")


def _bearer(app, user_id="00000000-0000-0000-0000-000000000001"):
    with app.app_context():
        token = create_access_token(
            identity=user_id,
            additional_claims={"role": "data_scientist", "tier": "company"},
        )
    return {"Authorization": f"Bearer {token}"}


@resp_mock.activate
def test_pipeline_chat_blocked_when_acl_denies(client, app):
    resp_mock.add(
        resp_mock.GET,
        f"{ML_BASE}/pipelines/p1/_acl-meta",
        json={
            "pipeline_id": "p1",
            "user_id": "ownerX",
            "owner_type": "personal",
            "company_id": None,
        },
        status=200,
    )
    resp_mock.add(
        resp_mock.POST,
        f"{AUTH_BASE}/acl/projects/check",
        json={"allowed": False, "role": None, "reason": "personal_not_owner"},
        status=200,
    )

    resp = client.post(
        "/pipelines/p1/chat",
        headers=_bearer(app),
        json={"message": "hi"},
    )
    assert resp.status_code == 403
    body = resp.get_json()
    assert body["error"] == "forbidden"
    assert body["reason"] == "personal_not_owner"


@resp_mock.activate
def test_pipeline_chat_allowed_forwards_with_company_header(client, app):
    resp_mock.add(
        resp_mock.GET,
        f"{ML_BASE}/pipelines/p2/_acl-meta",
        json={
            "pipeline_id": "p2",
            "user_id": "someone",
            "owner_type": "company",
            "company_id": "co-123",
        },
        status=200,
    )
    resp_mock.add(
        resp_mock.POST,
        f"{AUTH_BASE}/acl/projects/check",
        json={"allowed": True, "role": "editor", "reason": "role:editor"},
        status=200,
    )
    upstream_call = resp_mock.add(
        resp_mock.POST,
        f"{ML_BASE}/pipelines/p2/chat",
        json={"answer": "ok"},
        status=200,
    )

    resp = client.post(
        "/pipelines/p2/chat",
        headers=_bearer(app),
        json={"message": "hi"},
    )
    assert resp.status_code == 200

    forwarded = upstream_call.calls[0].request.headers
    assert forwarded.get("X-User-Id")
    assert forwarded.get("X-Company-Id") == "co-123"
    assert forwarded.get("X-Project-Role") == "editor"


@resp_mock.activate
def test_pipeline_meta_404_returns_404(client, app):
    resp_mock.add(
        resp_mock.GET,
        f"{ML_BASE}/pipelines/missing/_acl-meta",
        json={"error": "not_found"},
        status=404,
    )
    resp = client.post(
        "/pipelines/missing/chat",
        headers=_bearer(app),
        json={"message": "x"},
    )
    assert resp.status_code == 404


@resp_mock.activate
def test_client_supplied_x_user_headers_are_stripped(client, app):
    """A malicious client cannot forge X-User-Role to bypass ACL."""
    resp_mock.add(
        resp_mock.GET,
        f"{ML_BASE}/pipelines/p3/_acl-meta",
        json={
            "pipeline_id": "p3",
            "user_id": "real-owner",
            "owner_type": "company",
            "company_id": "co-9",
        },
        status=200,
    )
    resp_mock.add(
        resp_mock.POST,
        f"{AUTH_BASE}/acl/projects/check",
        json={"allowed": True, "role": "viewer", "reason": "role:viewer"},
        status=200,
    )
    upstream = resp_mock.add(
        resp_mock.POST,
        f"{ML_BASE}/pipelines/p3/chat",
        json={"ok": True},
        status=200,
    )

    headers = _bearer(app)
    headers.update(
        {
            "X-User-Role": "super_admin",  # forged
            "X-Company-Id": "co-attacker",  # forged
        }
    )
    client.post("/pipelines/p3/chat", headers=headers, json={"message": "x"})

    forwarded = upstream.calls[0].request.headers
    # Forged values must be replaced by gateway-resolved truth.
    assert forwarded.get("X-Company-Id") == "co-9"
    assert forwarded.get("X-User-Role") == "data_scientist"
