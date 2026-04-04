"""
Integration tests for billing routes.
"""

import uuid

from flask_jwt_extended import create_access_token


def _user_headers(app, tier="free"):
    with app.app_context():
        token = create_access_token(
            identity=str(uuid.uuid4()),
            additional_claims={"role": "data_scientist", "tier": tier},
        )
    return {"Authorization": f"Bearer {token}"}


# ── Plans ─────────────────────────────────────────────────────────────────────


def test_get_plans_public(client):
    """Plans endpoint is public — no auth required."""
    resp = client.get("/billing/plans")
    assert resp.status_code == 200
    plans = resp.get_json()
    assert isinstance(plans, list)
    names = [p["plan"] for p in plans]
    assert "free" in names
    assert "solo_monthly" in names
    assert "company_yearly" in names


# ── Subscription ──────────────────────────────────────────────────────────────


def test_get_subscription_no_sub(client, app):
    """Returns free plan default when no subscription exists."""
    resp = client.get("/billing/subscription", headers=_user_headers(app))
    assert resp.status_code == 200
    body = resp.get_json()
    assert body["plan"] == "free"
    assert body["status"] == "active"


# ── Checkout ──────────────────────────────────────────────────────────────────


def test_checkout_billing_unavailable(client, app):
    """Without STRIPE_SECRET_KEY, checkout returns 503 billing_unavailable."""
    resp = client.post(
        "/billing/checkout",
        json={"plan": "solo_monthly"},
        headers=_user_headers(app),
    )
    # Stripe not configured in test env → 503
    assert resp.status_code == 503
    assert resp.get_json()["error"] == "billing_unavailable"


def test_checkout_invalid_plan(client, app):
    resp = client.post(
        "/billing/checkout",
        json={"plan": "invalid_plan"},
        headers=_user_headers(app),
    )
    assert resp.status_code == 400


def test_checkout_requires_auth(client):
    resp = client.post("/billing/checkout", json={"plan": "solo_monthly"})
    assert resp.status_code == 401


# ── Portal ────────────────────────────────────────────────────────────────────


def test_portal_billing_unavailable(client, app):
    resp = client.post("/billing/portal", json={}, headers=_user_headers(app))
    assert resp.status_code in (
        503,
        400,
    )  # 503 if Stripe not configured, 400 if no subscription


# ── Webhook ───────────────────────────────────────────────────────────────────


def test_webhook_no_stripe_config_accepts(client):
    """Webhook without Stripe config should return 200 (graceful no-op)."""
    resp = client.post(
        "/billing/webhook",
        data=b'{"type": "test"}',
        content_type="application/json",
    )
    assert resp.status_code == 200


# ── Public announcements ──────────────────────────────────────────────────────


def test_public_announcements(client):
    resp = client.get("/billing/announcements")
    assert resp.status_code == 200
    assert isinstance(resp.get_json(), list)
