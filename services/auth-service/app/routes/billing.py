"""
Billing routes — Stripe checkout, portal, webhooks.
"""

import os

from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required
from marshmallow import ValidationError

from ..models.user import User
from ..schemas.billing import CheckoutSchema
from ..services import billing_service
from ..services.billing_service import BillingUnavailable

billing_bp = Blueprint("billing", __name__, url_prefix="/billing")

_checkout_schema = CheckoutSchema()


@billing_bp.get("/plans")
def list_plans():
    """Public endpoint — no auth required."""
    return jsonify(billing_service.get_plans()), 200


@billing_bp.get("/subscription")
@jwt_required()
def get_subscription():
    user_id = get_jwt_identity()
    sub = billing_service.get_user_subscription(user_id)
    if not sub:
        return (
            jsonify(
                {
                    "plan": "free",
                    "status": "active",
                    "trial_end": None,
                    "current_period_end": None,
                }
            ),
            200,
        )
    return jsonify(sub), 200


@billing_bp.post("/checkout")
@jwt_required()
def create_checkout():
    try:
        data = _checkout_schema.load(request.get_json() or {})
    except ValidationError as e:
        return jsonify({"error": "validation_error", "detail": e.messages}), 400

    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    if not user:
        return jsonify({"error": "not_found"}), 404

    frontend_url = os.environ.get("FRONTEND_URL", "http://localhost:5173")
    success_url = data.get("success_url") or f"{frontend_url}/billing?success=1"
    cancel_url = data.get("cancel_url") or f"{frontend_url}/billing?canceled=1"

    try:
        checkout_url = billing_service.create_checkout_session(
            user=user, plan=data["plan"], success_url=success_url, cancel_url=cancel_url
        )
    except BillingUnavailable as e:
        return jsonify({"error": "billing_unavailable", "message": str(e)}), 503
    except ValueError as e:
        return jsonify({"error": str(e)}), 400

    return jsonify({"checkout_url": checkout_url}), 200


@billing_bp.post("/portal")
@jwt_required()
def create_portal():
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    if not user:
        return jsonify({"error": "not_found"}), 404

    frontend_url = os.environ.get("FRONTEND_URL", "http://localhost:5173")
    return_url = request.get_json(silent=True, force=True) or {}
    return_url = return_url.get("return_url") or f"{frontend_url}/billing"

    try:
        portal_url = billing_service.create_portal_session(
            user=user, return_url=return_url
        )
    except BillingUnavailable as e:
        return jsonify({"error": "billing_unavailable", "message": str(e)}), 503
    except ValueError as e:
        return jsonify({"error": str(e)}), 400

    return jsonify({"portal_url": portal_url}), 200


@billing_bp.get("/announcements")
def public_announcements():
    """Return active announcements — no auth required."""
    from ..services.admin_service import list_announcements

    anns = list_announcements(active_only=True)
    return (
        jsonify(
            [
                {
                    "id": str(a.id),
                    "title": a.title,
                    "body": a.body,
                    "created_at": a.created_at.isoformat(),
                }
                for a in anns
            ]
        ),
        200,
    )


@billing_bp.post("/webhook")
def stripe_webhook():
    """Stripe sends unsigned webhooks in test mode; validates signature in production."""
    payload = request.get_data()
    sig_header = request.headers.get("Stripe-Signature", "")

    try:
        billing_service.handle_webhook(payload, sig_header)
    except BillingUnavailable:
        # Stripe not configured — accept but ignore (for local dev)
        return jsonify({"received": True}), 200
    except ValueError as e:
        return jsonify({"error": str(e)}), 400

    return jsonify({"received": True}), 200
