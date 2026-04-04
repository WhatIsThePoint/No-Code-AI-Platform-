import secrets
import uuid
from datetime import datetime, timedelta, timezone

from ..extensions import db
from ..models.company import Company, Invitation, Membership
from ..models.user import User

INVITE_EXPIRY_HOURS = 72

# Roles that a PM is allowed to invite (cannot invite roles at or above PM)
PM_ALLOWED_ROLES = {"analyst", "viewer"}


def create_company(name: str, slug: str | None, owner: User) -> Company:
    if not slug:
        slug = _slugify(name)

    # Ensure slug uniqueness
    base_slug = slug
    counter = 1
    while Company.query.filter_by(slug=slug).first():
        slug = f"{base_slug}-{counter}"
        counter += 1

    company = Company(name=name, slug=slug, owner_id=owner.id)
    db.session.add(company)
    db.session.flush()

    # Owner is automatically an active member
    membership = Membership(
        company_id=company.id,
        user_id=owner.id,
        role="owner",
        status="active",
    )
    db.session.add(membership)
    db.session.commit()
    return company


def get_membership(company_id: uuid.UUID, user_id: uuid.UUID) -> Membership | None:
    return Membership.query.filter_by(
        company_id=company_id, user_id=user_id, status="active"
    ).first()


def invite_member(
    company: Company,
    inviter: User,
    inviter_membership: Membership,
    email: str,
    role: str,
) -> Invitation:
    # RBAC: PM can only invite lower roles
    if inviter_membership.role == "pm" and role not in PM_ALLOWED_ROLES:
        raise PermissionError("pm_cannot_invite_this_role")

    token = secrets.token_urlsafe(32)
    expires_at = datetime.now(timezone.utc) + timedelta(hours=INVITE_EXPIRY_HOURS)

    # Invalidate any pending invite for same email + company
    Invitation.query.filter_by(
        company_id=company.id, email=email, accepted=False
    ).delete()

    invite = Invitation(
        company_id=company.id,
        email=email,
        role=role,
        token=token,
        expires_at=expires_at,
    )
    db.session.add(invite)
    db.session.commit()
    return invite


def accept_invitation(token: str, user: User) -> Membership:
    invite = Invitation.query.filter_by(token=token, accepted=False).first()
    if not invite:
        raise ValueError("invalid_token")
    if invite.expires_at.replace(tzinfo=timezone.utc) < datetime.now(timezone.utc):
        raise ValueError("invitation_expired")
    if invite.email.lower() != user.email.lower():
        raise ValueError("email_mismatch")

    invite.accepted = True

    # Create or reactivate membership
    membership = Membership.query.filter_by(
        company_id=invite.company_id, user_id=user.id
    ).first()
    if membership:
        membership.role = invite.role
        membership.status = "active"
    else:
        membership = Membership(
            company_id=invite.company_id,
            user_id=user.id,
            role=invite.role,
            status="active",
        )
        db.session.add(membership)

    db.session.commit()
    return membership


def remove_member(company_id: uuid.UUID, target_user_id: uuid.UUID) -> None:
    membership = Membership.query.filter_by(
        company_id=company_id, user_id=target_user_id
    ).first()
    if membership:
        membership.status = "revoked"
        db.session.commit()


def _slugify(name: str) -> str:
    import re

    slug = name.lower().strip()
    slug = re.sub(r"[^\w\s-]", "", slug)
    slug = re.sub(r"[\s_-]+", "-", slug)
    return slug[:100]
