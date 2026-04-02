from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required
from marshmallow import ValidationError

from ..extensions import db
from ..models.user import User
from ..schemas.user import UpdateProfileSchema, UserSchema

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
    return jsonify(_user_schema.dump(user)), 200


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

    db.session.commit()
    return jsonify(_user_schema.dump(user)), 200
