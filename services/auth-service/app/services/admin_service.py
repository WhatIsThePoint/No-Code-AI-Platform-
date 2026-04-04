"""
Admin operations: user management, company management, audit log, announcements.
"""

from __future__ import annotations

import uuid
from typing import Optional

from ..extensions import db
from ..models.company import Company
from ..models.subscription import Announcement, AuditLog, Subscription
from ..models.user import User

# ── Audit Logging ─────────────────────────────────────────────────────────────


def log_action(
    action: str,
    actor_id: Optional[str] = None,
    target_type: Optional[str] = None,
    target_id: Optional[str] = None,
    detail: Optional[dict] = None,
    ip_address: Optional[str] = None,
) -> None:
    entry = AuditLog(
        actor_id=uuid.UUID(actor_id) if actor_id else None,
        action=action,
        target_type=target_type,
        target_id=str(target_id) if target_id else None,
        detail=detail,
        ip_address=ip_address,
    )
    db.session.add(entry)
    db.session.commit()


# ── User Management ───────────────────────────────────────────────────────────


def list_users(
    q: str = "", page: int = 1, limit: int = 20, role=None, tier=None, is_active=None
):
    query = User.query
    if q:
        like = f"%{q}%"
        query = query.filter(db.or_(User.email.ilike(like), User.full_name.ilike(like)))
    if role is not None:
        query = query.filter(User.role == role)
    if tier is not None:
        query = query.filter(User.tier == tier)
    if is_active is not None:
        query = query.filter(User.is_active == is_active)

    total = query.count()
    users = (
        query.order_by(User.created_at.desc())
        .offset((page - 1) * limit)
        .limit(limit)
        .all()
    )
    return users, total


def get_user(user_id: str) -> Optional[User]:
    return User.query.get(uuid.UUID(user_id))


def update_user(user_id: str, is_active=None, role=None, tier=None) -> User:
    user = User.query.get(uuid.UUID(user_id))
    if not user:
        raise ValueError("not_found")
    if is_active is not None:
        user.is_active = is_active
    if role is not None:
        user.role = role
    if tier is not None:
        user.tier = tier
        # Sync subscription plan when tier is manually overridden
        sub = Subscription.query.filter_by(user_id=user.id).first()
        if sub:
            sub.plan = tier if tier in ("free",) else f"{tier}_monthly"
    db.session.commit()
    return user


def delete_user(user_id: str) -> None:
    user = User.query.get(uuid.UUID(user_id))
    if not user:
        raise ValueError("not_found")
    db.session.delete(user)
    db.session.commit()


# ── Company Management ────────────────────────────────────────────────────────


def list_companies(q: str = "", page: int = 1, limit: int = 20):
    query = Company.query
    if q:
        query = query.filter(
            db.or_(Company.name.ilike(f"%{q}%"), Company.slug.ilike(f"%{q}%"))
        )
    total = query.count()
    companies = (
        query.order_by(Company.created_at.desc())
        .offset((page - 1) * limit)
        .limit(limit)
        .all()
    )
    return companies, total


def delete_company(company_id: str) -> None:
    company = Company.query.get(uuid.UUID(company_id))
    if not company:
        raise ValueError("not_found")
    db.session.delete(company)
    db.session.commit()


# ── Subscription Override ─────────────────────────────────────────────────────


def override_subscription(
    user_id: str, plan: str, status: str = "active"
) -> Subscription:
    from ..models.subscription import PLAN_TO_TIER

    user = User.query.get(uuid.UUID(user_id))
    if not user:
        raise ValueError("not_found")

    sub = Subscription.query.filter_by(user_id=user.id).first()
    if sub:
        sub.plan = plan
        sub.status = status
        sub.stripe_subscription_id = None  # manual override clears Stripe link
    else:
        sub = Subscription(user_id=user.id, plan=plan, status=status)
        db.session.add(sub)

    # Sync user tier
    user.tier = PLAN_TO_TIER.get(plan, "free")
    db.session.commit()
    return sub


# ── Audit Logs ────────────────────────────────────────────────────────────────


def list_logs(action=None, actor_id=None, target_type=None, page=1, limit=50):
    query = AuditLog.query
    if action:
        query = query.filter(AuditLog.action.ilike(f"%{action}%"))
    if actor_id:
        try:
            query = query.filter(AuditLog.actor_id == uuid.UUID(actor_id))
        except ValueError:
            pass
    if target_type:
        query = query.filter(AuditLog.target_type == target_type)
    total = query.count()
    logs = (
        query.order_by(AuditLog.created_at.desc())
        .offset((page - 1) * limit)
        .limit(limit)
        .all()
    )
    return logs, total


# ── Stats ─────────────────────────────────────────────────────────────────────


def get_platform_stats() -> dict:
    total_users = User.query.count()
    active_users = User.query.filter_by(is_active=True).count()
    total_companies = Company.query.count()
    paid_subs = Subscription.query.filter(
        Subscription.plan != "free",
        Subscription.status.in_(["active", "trialing"]),
    ).count()
    return {
        "total_users": total_users,
        "active_users": active_users,
        "suspended_users": total_users - active_users,
        "total_companies": total_companies,
        "paid_subscriptions": paid_subs,
    }


# ── Announcements ─────────────────────────────────────────────────────────────


def create_announcement(
    created_by: str, title: str, body: str, is_active: bool = True
) -> Announcement:
    ann = Announcement(
        created_by=uuid.UUID(created_by),
        title=title,
        body=body,
        is_active=is_active,
    )
    db.session.add(ann)
    db.session.commit()
    return ann


def list_announcements(active_only: bool = False):
    query = Announcement.query
    if active_only:
        query = query.filter_by(is_active=True)
    return query.order_by(Announcement.created_at.desc()).all()


def update_announcement(ann_id: str, **kwargs) -> Announcement:
    ann = Announcement.query.get(uuid.UUID(ann_id))
    if not ann:
        raise ValueError("not_found")
    for k, v in kwargs.items():
        if v is not None:
            setattr(ann, k, v)
    db.session.commit()
    return ann


def delete_announcement(ann_id: str) -> None:
    ann = Announcement.query.get(uuid.UUID(ann_id))
    if not ann:
        raise ValueError("not_found")
    db.session.delete(ann)
    db.session.commit()
