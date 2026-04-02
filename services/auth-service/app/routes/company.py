import uuid

from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required
from marshmallow import ValidationError

from ..extensions import db
from ..models.company import Company, Membership
from ..models.user import User
from ..schemas.company import CreateCompanySchema, InviteMemberSchema, MembershipSchema
from ..services import company_service

company_bp = Blueprint("company", __name__, url_prefix="/companies")

_create_schema = CreateCompanySchema()
_invite_schema = InviteMemberSchema()
_membership_schema = MembershipSchema(many=True)


@company_bp.post("")
@jwt_required()
def create_company():
    try:
        data = _create_schema.load(request.get_json() or {})
    except ValidationError as e:
        return jsonify({"error": "validation_error", "detail": e.messages}), 400

    user = User.query.get(get_jwt_identity())
    company = company_service.create_company(
        name=data["name"], slug=data.get("slug"), owner=user
    )
    return jsonify({"company_id": str(company.id), "name": company.name, "slug": company.slug}), 201


@company_bp.get("/<company_id>")
@jwt_required()
def get_company(company_id):
    company, membership = _get_company_and_membership(company_id)
    if not company:
        return jsonify({"error": "not_found"}), 404
    if not membership:
        return jsonify({"error": "forbidden"}), 403
    return jsonify(
        {
            "company_id": str(company.id),
            "name": company.name,
            "slug": company.slug,
            "owner_id": str(company.owner_id),
            "created_at": company.created_at.isoformat(),
            "your_role": membership.role,
        }
    ), 200


@company_bp.get("/<company_id>/members")
@jwt_required()
def list_members(company_id):
    company, membership = _get_company_and_membership(company_id)
    if not company:
        return jsonify({"error": "not_found"}), 404
    if not membership:
        return jsonify({"error": "forbidden"}), 403

    members = Membership.query.filter_by(company_id=company.id, status="active").all()
    result = [
        {
            "user_id": str(m.user_id),
            "role": m.role,
            "status": m.status,
            "created_at": m.created_at.isoformat(),
        }
        for m in members
    ]
    return jsonify(result), 200


@company_bp.post("/<company_id>/invite")
@jwt_required()
def invite_member(company_id):
    try:
        data = _invite_schema.load(request.get_json() or {})
    except ValidationError as e:
        return jsonify({"error": "validation_error", "detail": e.messages}), 400

    company, membership = _get_company_and_membership(company_id)
    if not company:
        return jsonify({"error": "not_found"}), 404
    if not membership or membership.role not in ("owner", "pm"):
        return jsonify({"error": "forbidden", "message": "Only owner or PM can invite"}), 403

    user = User.query.get(get_jwt_identity())
    try:
        invite = company_service.invite_member(
            company=company,
            inviter=user,
            inviter_membership=membership,
            email=data["email"],
            role=data["role"],
        )
    except PermissionError as e:
        return jsonify({"error": "forbidden", "message": str(e)}), 403

    return jsonify(
        {
            "invitation_id": str(invite.id),
            "token": invite.token,  # In prod, send via email instead
            "email": invite.email,
            "role": invite.role,
            "expires_at": invite.expires_at.isoformat(),
        }
    ), 201


@company_bp.delete("/<company_id>/members/<target_user_id>")
@jwt_required()
def remove_member(company_id, target_user_id):
    company, membership = _get_company_and_membership(company_id)
    if not company:
        return jsonify({"error": "not_found"}), 404
    if not membership or membership.role != "owner":
        return jsonify({"error": "forbidden", "message": "Only owner can remove members"}), 403

    company_service.remove_member(company.id, uuid.UUID(target_user_id))
    return "", 204


@company_bp.get("/invitations/accept/<token>")
@jwt_required()
def accept_invitation(token):
    user = User.query.get(get_jwt_identity())
    try:
        membership = company_service.accept_invitation(token, user)
    except ValueError as e:
        return jsonify({"error": str(e)}), 400

    return jsonify(
        {
            "message": "invitation_accepted",
            "company_id": str(membership.company_id),
            "role": membership.role,
        }
    ), 200


def _get_company_and_membership(company_id_str: str):
    try:
        cid = uuid.UUID(company_id_str)
    except ValueError:
        return None, None

    company = Company.query.get(cid)
    if not company:
        return None, None

    from flask_jwt_extended import get_jwt_identity

    user_id = get_jwt_identity()
    membership = company_service.get_membership(cid, uuid.UUID(user_id))
    return company, membership
