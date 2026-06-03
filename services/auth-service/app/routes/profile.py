from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required
from marshmallow import ValidationError

from ..extensions import db
from ..models.subscription import Subscription
from ..models.user import User
from ..schemas.user import UpdateProfileSchema, UserSchema
from ..services.plan_limits import effective_limits

profile_bp = Blueprint("profile", __name__, url_prefix="/users")

_user_schema = UserSchema()
_update_schema = UpdateProfileSchema()


@profile_bp.get("/me")
@jwt_required()
def get_profile():
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    if not user:
        return jsonify({"error": "user_not_found"}), 404
    body = _user_schema.dump(user)
    # Inline the user's effective resource ceilings so the frontend can
    # clamp slider maxes (DL train epochs / batch size) and gate UI
    # affordances (RAG chunk warnings) without a second round-trip. The
    # gateway forwards the same numbers as `X-Max-*` headers when proxying
    # to dl-training-service so the server-side guard stays authoritative.
    sub = Subscription.query.filter_by(user_id=user.id).one_or_none()
    overrides = (
        {
            "max_chunks": sub.max_chunks,
            "max_vram_mb": sub.max_vram_mb,
            "max_dl_epochs": sub.max_dl_epochs,
            "max_dl_batch_size": sub.max_dl_batch_size,
        }
        if sub is not None
        else None
    )
    body["limits"] = effective_limits(user.tier, overrides)
    return jsonify(body), 200


@profile_bp.patch("/me")
@jwt_required()
def update_profile():
    try:
        data = _update_schema.load(request.get_json() or {})
    except ValidationError as e:
        return jsonify({"error": "validation_error", "detail": e.messages}), 400

    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    if not user:
        return jsonify({"error": "user_not_found"}), 404

    if "full_name" in data:
        user.full_name = data["full_name"]
    if "role" in data:
        user.role = data["role"]
    if "has_seen_pipeline_tour" in data:
        user.has_seen_pipeline_tour = data["has_seen_pipeline_tour"]
    if "has_seen_genai_tour" in data:
        user.has_seen_genai_tour = data["has_seen_genai_tour"]
    if "has_seen_dl_tour" in data:
        user.has_seen_dl_tour = data["has_seen_dl_tour"]

    db.session.commit()
    return jsonify(_user_schema.dump(user)), 200


@profile_bp.get("/public/<user_id>")
@jwt_required()
def public_user(user_id):
    """Minimal public-safe lookup: full_name + email only.

    Used by collaboration UIs (e.g. "Edited by Alice Martin · 2h ago") to
    resolve a user_id stamp without exposing role, tier, or audit fields.
    Any authenticated caller can hit this — no super-admin gate — since the
    information here is already visible in pipeline messages and project
    member lists.
    """
    try:
        user = User.query.get(user_id)
    except Exception:
        return jsonify({"error": "invalid_id"}), 400
    if not user:
        return jsonify({"error": "not_found"}), 404
    return (
        jsonify(
            {
                "user_id": str(user.id),
                "full_name": user.full_name,
                "email": user.email,
            }
        ),
        200,
    )
