from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt, jwt_required
from marshmallow import ValidationError

from ..schemas.auth import LoginSchema, RegisterSchema
from ..services import auth_service

auth_bp = Blueprint("auth", __name__, url_prefix="/auth")

_register_schema = RegisterSchema()
_login_schema = LoginSchema()


@auth_bp.post("/register")
def register():
    try:
        data = _register_schema.load(request.get_json() or {})
    except ValidationError as e:
        return jsonify({"error": "validation_error", "detail": e.messages}), 400

    try:
        user = auth_service.register_user(
            email=data["email"],
            password=data["password"],
            full_name=data.get("full_name"),
            role=data["role"],
        )
    except ValueError as e:
        if str(e) == "email_taken":
            return (
                jsonify({"error": "email_taken", "message": "Email already in use"}),
                409,
            )
        raise

    return (
        jsonify(
            {"user_id": str(user.id), "email": user.email, "message": "registered"}
        ),
        201,
    )


@auth_bp.post("/login")
def login():
    try:
        data = _login_schema.load(request.get_json() or {})
    except ValidationError as e:
        return jsonify({"error": "validation_error", "detail": e.messages}), 400

    user = auth_service.authenticate_user(data["email"], data["password"])
    if not user:
        return (
            jsonify(
                {"error": "invalid_credentials", "message": "Invalid email or password"}
            ),
            401,
        )

    if user.totp_enabled:
        session_token = auth_service.issue_2fa_session_token(str(user.id))
        return jsonify({"requires_2fa": True, "session_token": session_token}), 200

    access_token, raw_refresh = auth_service.issue_tokens(user)
    resp = jsonify({"access_token": access_token, "token_type": "bearer"})
    _set_refresh_cookie(resp, raw_refresh)
    return resp, 200


@auth_bp.post("/refresh")
def refresh():
    raw_token = request.cookies.get("refresh_token")
    if not raw_token:
        return jsonify({"error": "missing_refresh_token"}), 401

    result = auth_service.rotate_refresh_token(raw_token)
    if not result:
        return jsonify({"error": "invalid_refresh_token"}), 401

    access_token, new_raw = result
    resp = jsonify({"access_token": access_token, "token_type": "bearer"})
    _set_refresh_cookie(resp, new_raw)
    return resp, 200


@auth_bp.post("/logout")
@jwt_required()
def logout():
    # Revoke refresh token
    raw_token = request.cookies.get("refresh_token")
    if raw_token:
        auth_service.revoke_refresh_token(raw_token)

    # Blacklist access token JTI
    claims = get_jwt()
    auth_service.blacklist_access_token(claims["jti"], claims["exp"])

    resp = jsonify({"message": "logged_out"})
    resp.delete_cookie("refresh_token")
    return resp, 200


def _set_refresh_cookie(response, raw_token: str):
    response.set_cookie(
        "refresh_token",
        raw_token,
        httponly=True,
        secure=False,  # set True in production behind HTTPS
        samesite="Strict",
        max_age=30 * 24 * 3600,
        path="/auth/refresh",
    )
