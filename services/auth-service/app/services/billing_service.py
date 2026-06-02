"""
Stripe billing integration.
Gracefully handles missing STRIPE_SECRET_KEY (returns billing_unavailable).
"""

from __future__ import annotations

import os
from typing import Optional

from ..extensions import db
from ..models.subscription import PLAN_TO_TIER, Subscription
from ..models.user import User

# Price IDs are configured per environment
_PRICE_IDS = {
    "solo_monthly": os.environ.get("STRIPE_PRICE_SOLO_MONTHLY", ""),
    "solo_yearly": os.environ.get("STRIPE_PRICE_SOLO_YEARLY", ""),
    "company_monthly": os.environ.get("STRIPE_PRICE_COMPANY_MONTHLY", ""),
    "company_yearly": os.environ.get("STRIPE_PRICE_COMPANY_YEARLY", ""),
}

_PLAN_DISPLAY = {
    "free": {"name": "Free", "price_usd": 0, "interval": None},
    "solo_monthly": {"name": "Solo Monthly", "price_usd": 29, "interval": "month"},
    "solo_yearly": {"name": "Solo Yearly", "price_usd": 290, "interval": "year"},
    "company_monthly": {
        "name": "Company Monthly",
        "price_usd": 99,
        "interval": "month",
    },
    "company_yearly": {"name": "Company Yearly", "price_usd": 990, "interval": "year"},
}


def _get_stripe():
    """Return configured stripe module or raise BillingUnavailable."""
    secret = os.environ.get("STRIPE_SECRET_KEY", "")
    if not secret:
        raise BillingUnavailable("Stripe not configured")
    try:
        import stripe  # noqa: PLC0415
    except ImportError:
        raise BillingUnavailable("stripe package not installed")
    stripe.api_key = secret
    return stripe


class BillingUnavailable(Exception):
    pass


def get_plans() -> list[dict]:
    return [
        {"plan": k, **v, "tier": PLAN_TO_TIER.get(k, "free")}
        for k, v in _PLAN_DISPLAY.items()
    ]


def get_or_create_customer(user: User, stripe) -> str:
    sub = Subscription.query.filter_by(user_id=user.id).first()
    if sub and sub.stripe_customer_id:
        return sub.stripe_customer_id
    customer = stripe.Customer.create(
        email=user.email, name=user.full_name or user.email
    )
    if not sub:
        sub = Subscription(user_id=user.id, plan="free", status="active")
        db.session.add(sub)
    sub.stripe_customer_id = customer["id"]
    db.session.commit()
    return customer["id"]


def create_checkout_session(
    user: User, plan: str, success_url: str, cancel_url: str
) -> str:
    stripe = _get_stripe()
    price_id = _PRICE_IDS.get(plan, "")
    if not price_id:
        raise ValueError(f"No Stripe price ID configured for plan '{plan}'")

    customer_id = get_or_create_customer(user, stripe)
    session = stripe.checkout.Session.create(
        customer=customer_id,
        mode="subscription",
        line_items=[{"price": price_id, "quantity": 1}],
        subscription_data={"trial_period_days": 14},
        success_url=success_url,
        cancel_url=cancel_url,
        metadata={"user_id": str(user.id), "plan": plan},
    )
    return session["url"]


def create_portal_session(user: User, return_url: str) -> str:
    stripe = _get_stripe()
    sub = Subscription.query.filter_by(user_id=user.id).first()
    if not sub or not sub.stripe_customer_id:
        raise ValueError("no_subscription")
    session = stripe.billing_portal.Session.create(
        customer=sub.stripe_customer_id,
        return_url=return_url,
    )
    return session["url"]


def handle_webhook(payload: bytes, sig_header: str) -> None:
    """Process a Stripe webhook event and update the subscription accordingly."""
    stripe = _get_stripe()
    webhook_secret = os.environ.get("STRIPE_WEBHOOK_SECRET", "")
    try:
        event = stripe.Webhook.construct_event(payload, sig_header, webhook_secret)
    except (stripe.error.SignatureVerificationError, ValueError) as e:
        raise ValueError(f"webhook_invalid: {e}")

    _process_event(event, stripe)


def _process_event(event: dict, stripe) -> None:
    etype = event["type"]

    if etype == "checkout.session.completed":
        session = event["data"]["object"]
        user_id = session.get("metadata", {}).get("user_id")
        plan = session.get("metadata", {}).get("plan", "free")
        stripe_sub_id = session.get("subscription")
        if user_id:
            _activate_subscription(user_id, plan, stripe_sub_id, stripe)

    elif etype in ("customer.subscription.updated", "customer.subscription.deleted"):
        stripe_sub = event["data"]["object"]
        _sync_subscription(stripe_sub)

    elif etype == "invoice.payment_failed":
        invoice = event["data"]["object"]
        stripe_sub_id = invoice.get("subscription")
        if stripe_sub_id:
            sub = Subscription.query.filter_by(
                stripe_subscription_id=stripe_sub_id
            ).first()
            if sub:
                sub.status = "past_due"
                db.session.commit()


def _activate_subscription(
    user_id: str, plan: str, stripe_sub_id: Optional[str], stripe
) -> None:
    import uuid as _uuid

    user = User.query.get(_uuid.UUID(user_id))
    if not user:
        return

    sub = Subscription.query.filter_by(user_id=user.id).first()
    if not sub:
        sub = Subscription(user_id=user.id)
        db.session.add(sub)

    sub.plan = plan
    sub.status = "trialing"
    if stripe_sub_id:
        sub.stripe_subscription_id = stripe_sub_id
        stripe_sub = stripe.Subscription.retrieve(stripe_sub_id)
        import datetime

        sub.trial_end = (
            datetime.datetime.fromtimestamp(
                stripe_sub.get("trial_end") or 0, tz=datetime.timezone.utc
            )
            if stripe_sub.get("trial_end")
            else None
        )
        # `current_period_end` lives at the top level on older API versions
        # and on `items.data[0].current_period_end` on 2025-03-31 and later.
        # Read whichever exists; fall back to None rather than raising.
        period_end_ts = stripe_sub.get("current_period_end")
        if not period_end_ts:
            items = stripe_sub.get("items", {}).get("data") or []
            if items:
                period_end_ts = items[0].get("current_period_end")
        if period_end_ts:
            sub.current_period_end = datetime.datetime.fromtimestamp(
                period_end_ts, tz=datetime.timezone.utc
            )

    user.tier = PLAN_TO_TIER.get(plan, "free")
    db.session.commit()


def _plan_from_stripe_price(stripe_sub: dict) -> Optional[str]:
    """Look at the subscription's active line item, pull the price ID, and
    reverse-map back to our internal plan key (`solo_monthly`,
    `company_yearly`, etc.). Returns None if the price ID is unknown — that
    case keeps the existing plan rather than clobbering it."""
    try:
        items = stripe_sub.get("items", {}).get("data") or []
        if not items:
            return None
        price_id = items[0].get("price", {}).get("id")
        if not price_id:
            return None
        for plan_key, configured_id in _PRICE_IDS.items():
            if configured_id and configured_id == price_id:
                return plan_key
    except Exception:
        pass
    return None


def _sync_subscription(stripe_sub: dict) -> None:
    import datetime

    sub = Subscription.query.filter_by(stripe_subscription_id=stripe_sub["id"]).first()
    if not sub:
        return

    status_map = {
        "active": "active",
        "trialing": "trialing",
        "past_due": "past_due",
        "canceled": "canceled",
        "incomplete": "incomplete",
        "incomplete_expired": "canceled",
        "unpaid": "past_due",
    }
    sub.status = status_map.get(stripe_sub["status"], stripe_sub["status"])
    if stripe_sub.get("current_period_end"):
        sub.current_period_end = datetime.datetime.fromtimestamp(
            stripe_sub["current_period_end"], tz=datetime.timezone.utc
        )

    # Keep `sub.plan` and `user.tier` in lockstep with the active Stripe
    # price. Portal-driven upgrades / downgrades fire customer.subscription.
    # updated without ever firing a fresh checkout.session.completed, so this
    # is the only path that catches a plan change made outside the Checkout
    # flow.
    new_plan = _plan_from_stripe_price(stripe_sub)
    if new_plan and new_plan != sub.plan and sub.status not in ("canceled",):
        sub.plan = new_plan
        user = User.query.get(sub.user_id)
        if user:
            user.tier = PLAN_TO_TIER.get(new_plan, user.tier)

    if stripe_sub.get("cancel_at_period_end") or sub.status == "canceled":
        user = User.query.get(sub.user_id)
        if user:
            user.tier = "free"
            sub.plan = "free"
    db.session.commit()


def get_user_subscription(user_id: str) -> Optional[dict]:
    import uuid as _uuid

    sub = Subscription.query.filter_by(user_id=_uuid.UUID(user_id)).first()
    if not sub:
        return None
    return {
        "plan": sub.plan,
        "status": sub.status,
        "trial_end": sub.trial_end.isoformat() if sub.trial_end else None,
        "current_period_end": (
            sub.current_period_end.isoformat() if sub.current_period_end else None
        ),
        "stripe_customer_id": sub.stripe_customer_id,
    }
