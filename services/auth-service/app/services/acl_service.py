"""Sprint 6 — project-level access control logic.

Decision tree (in this order):
  1. Super Admin role        → grant ALL permissions, every project.
  2. Personal projects       → owner only. We don't store rows for these.
  3. Company Owner           → implicit admin on every project of that company.
  4. project_members lookup  → use stored role.

Role grants (highest wins):
  admin    → read, write, manage_members
  editor   → read, write
  viewer   → read
"""

from __future__ import annotations

from dataclasses import dataclass

from ..extensions import db
from ..models.company import Company, Membership
from ..models.project_member import ProjectMember
from ..models.user import User


@dataclass
class AccessDecision:
    allowed: bool
    role: str | None  # "admin" | "editor" | "viewer" | "owner" | "super_admin" | None
    reason: str       # human-readable, surfaced to the gateway/client


def _user_role(user_id: str) -> str | None:
    user = db.session.get(User, user_id)
    return user.role if user else None


def _is_company_owner(user_id: str, company_id: str) -> bool:
    company = db.session.get(Company, company_id)
    return bool(company and str(company.owner_id) == str(user_id))


def check_access(
    *,
    user_id: str,
    project_id: str,
    owner_type: str,           # 'personal' | 'company'
    project_owner_id: str,     # creator of the project (Mongo doc.user_id)
    company_id: str | None,    # the project's company_id (Mongo doc.company_id)
    required: str = "read",    # 'read' | 'write' | 'manage_members'
) -> AccessDecision:
    """Resolve access for a single user/project/permission triple."""

    # 1. Super admin bypass.
    if _user_role(user_id) == "super_admin":
        return AccessDecision(True, "super_admin", "super_admin")

    # 2. Personal project — only the creator.
    if owner_type == "personal" or not company_id:
        if str(project_owner_id) == str(user_id):
            return AccessDecision(True, "owner", "personal_owner")
        return AccessDecision(False, None, "personal_not_owner")

    # 3. Company owner implicit admin.
    if _is_company_owner(user_id, company_id):
        return AccessDecision(True, "admin", "company_owner")

    # User must have an active membership in the company.
    has_membership = (
        Membership.query.filter_by(
            user_id=user_id, company_id=company_id, status="active"
        ).first()
        is not None
    )
    if not has_membership:
        return AccessDecision(False, None, "no_company_membership")

    # 4. project_members row.
    pm = ProjectMember.query.filter_by(
        project_id=project_id, user_id=user_id
    ).first()
    if pm is None:
        # Project creator gets implicit admin even without a row.
        if str(project_owner_id) == str(user_id):
            return AccessDecision(True, "admin", "project_creator")
        return AccessDecision(False, None, "no_project_membership")

    role = pm.role
    if required == "read":
        return AccessDecision(True, role, f"role:{role}")
    if required == "write":
        if role in ("editor", "admin"):
            return AccessDecision(True, role, f"role:{role}")
        return AccessDecision(False, role, "viewer_cannot_write")
    if required == "manage_members":
        if role == "admin":
            return AccessDecision(True, role, "role:admin")
        return AccessDecision(False, role, "manage_members_requires_admin")

    return AccessDecision(False, role, "unknown_permission")


def list_members(project_id: str) -> list[dict]:
    rows = (
        db.session.query(ProjectMember, User)
        .join(User, User.id == ProjectMember.user_id)
        .filter(ProjectMember.project_id == project_id)
        .all()
    )
    return [
        {
            "user_id": str(pm.user_id),
            "email": user.email,
            "full_name": user.full_name,
            "role": pm.role,
            "granted_by": str(pm.granted_by) if pm.granted_by else None,
            "created_at": pm.created_at.isoformat() if pm.created_at else None,
        }
        for pm, user in rows
    ]


def add_or_update_member(
    *,
    project_id: str,
    company_id: str,
    user_id: str,
    role: str,
    granted_by: str,
) -> ProjectMember:
    if role not in ("viewer", "editor", "admin"):
        raise ValueError("invalid_role")

    pm = ProjectMember.query.filter_by(
        project_id=project_id, user_id=user_id
    ).first()
    if pm:
        pm.role = role
        pm.granted_by = granted_by
    else:
        pm = ProjectMember(
            project_id=project_id,
            company_id=company_id,
            user_id=user_id,
            role=role,
            granted_by=granted_by,
        )
        db.session.add(pm)
    db.session.commit()
    return pm


def remove_member(*, project_id: str, user_id: str) -> bool:
    pm = ProjectMember.query.filter_by(
        project_id=project_id, user_id=user_id
    ).first()
    if not pm:
        return False
    db.session.delete(pm)
    db.session.commit()
    return True
