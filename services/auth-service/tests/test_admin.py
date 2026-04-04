"""
Integration tests for admin routes.
All tests require a super_admin JWT.
"""

import uuid

from flask_jwt_extended import create_access_token


def _admin_headers(app):
    with app.app_context():
        token = create_access_token(
            identity=str(uuid.uuid4()),
            additional_claims={"role": "super_admin", "tier": "super_admin"},
        )
    return {"Authorization": f"Bearer {token}"}


def _user_headers(app):
    with app.app_context():
        token = create_access_token(
            identity=str(uuid.uuid4()),
            additional_claims={"role": "data_scientist", "tier": "free"},
        )
    return {"Authorization": f"Bearer {token}"}


# ── Access control ─────────────────────────────────────────────────────────────


def test_admin_users_requires_super_admin(client, app):
    resp = client.get("/admin/users", headers=_user_headers(app))
    assert resp.status_code == 403


def test_admin_users_without_token(client):
    resp = client.get("/admin/users")
    assert resp.status_code == 401


# ── Stats ──────────────────────────────────────────────────────────────────────


def test_admin_stats(client, app):
    resp = client.get("/admin/stats", headers=_admin_headers(app))
    assert resp.status_code == 200
    body = resp.get_json()
    assert "total_users" in body
    assert "paid_subscriptions" in body


# ── User list ─────────────────────────────────────────────────────────────────


def test_admin_list_users(client, app):
    resp = client.get("/admin/users", headers=_admin_headers(app))
    assert resp.status_code == 200
    body = resp.get_json()
    assert "items" in body
    assert "total" in body


def test_admin_list_users_search(client, app):
    resp = client.get("/admin/users?q=nobody@example.com", headers=_admin_headers(app))
    assert resp.status_code == 200
    body = resp.get_json()
    assert body["total"] == 0


# ── User CRUD ─────────────────────────────────────────────────────────────────


def test_admin_get_user_not_found(client, app):
    fake_id = str(uuid.uuid4())
    resp = client.get(f"/admin/users/{fake_id}", headers=_admin_headers(app))
    assert resp.status_code == 404


def test_admin_patch_user_not_found(client, app):
    fake_id = str(uuid.uuid4())
    resp = client.patch(
        f"/admin/users/{fake_id}",
        json={"is_active": False},
        headers=_admin_headers(app),
    )
    assert resp.status_code == 404


def test_admin_delete_user_not_found(client, app):
    fake_id = str(uuid.uuid4())
    resp = client.delete(f"/admin/users/{fake_id}", headers=_admin_headers(app))
    assert resp.status_code == 404


# ── Announcements ─────────────────────────────────────────────────────────────


def test_admin_create_and_list_announcements(client, app):
    headers = _admin_headers(app)

    resp = client.post(
        "/admin/announcements",
        json={"title": "Test Announcement", "body": "Hello world", "is_active": True},
        headers=headers,
    )
    assert resp.status_code == 201
    ann_id = resp.get_json()["id"]

    resp = client.get("/admin/announcements", headers=headers)
    assert resp.status_code == 200
    ids = [a["id"] for a in resp.get_json()]
    assert ann_id in ids


def test_admin_toggle_announcement(client, app):
    headers = _admin_headers(app)
    resp = client.post(
        "/admin/announcements",
        json={"title": "Toggle me", "body": "body", "is_active": True},
        headers=headers,
    )
    ann_id = resp.get_json()["id"]

    resp = client.patch(
        f"/admin/announcements/{ann_id}",
        json={"is_active": False},
        headers=headers,
    )
    assert resp.status_code == 200
    assert resp.get_json()["is_active"] is False


def test_admin_delete_announcement(client, app):
    headers = _admin_headers(app)
    resp = client.post(
        "/admin/announcements",
        json={"title": "Delete me", "body": "body"},
        headers=headers,
    )
    ann_id = resp.get_json()["id"]

    resp = client.delete(f"/admin/announcements/{ann_id}", headers=headers)
    assert resp.status_code == 204


# ── Audit logs ────────────────────────────────────────────────────────────────


def test_admin_list_logs_empty(client, app):
    resp = client.get("/admin/logs", headers=_admin_headers(app))
    assert resp.status_code == 200
    body = resp.get_json()
    assert "items" in body


# ── Companies ─────────────────────────────────────────────────────────────────


def test_admin_list_companies(client, app):
    resp = client.get("/admin/companies", headers=_admin_headers(app))
    assert resp.status_code == 200
    assert "items" in resp.get_json()


# ── Subscriptions ─────────────────────────────────────────────────────────────


def test_admin_list_subscriptions(client, app):
    resp = client.get("/admin/subscriptions", headers=_admin_headers(app))
    assert resp.status_code == 200
    assert "items" in resp.get_json()
