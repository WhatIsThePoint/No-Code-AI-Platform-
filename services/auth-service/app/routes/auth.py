from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt, jwt_required
from marshmallow import ValidationError

from ..schemas.auth import LoginSchema, RegisterSchema
from ..services import admin_service, auth_service

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
        user, _ = auth_service.register_user(
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
            {
                "user_id": str(user.id),
                "email": user.email,
                "email_verified": user.email_verified,
                "message": "registered" if user.email_verified else "verify_email_sent",
            }
        ),
        201,
    )


@auth_bp.post("/verify-email")
def verify_email():
    """Consume a verification token. Body: {"token": "..."}.
    Returns 200 on success, 400 on missing/invalid/expired token."""
    body = request.get_json() or {}
    token = body.get("token", "").strip()
    if not token:
        return jsonify({"error": "missing_token"}), 400
    user = auth_service.verify_email_token(token)
    if not user:
        return jsonify({"error": "invalid_or_expired_token"}), 400
    return jsonify({"email": user.email, "verified": True}), 200


@auth_bp.post("/resend-verification")
def resend_verification():
    """Best-effort: never reveal whether the email exists, always 200."""
    body = request.get_json() or {}
    email = (body.get("email") or "").strip().lower()
    if email:
        try:
            auth_service.resend_verification_email(email)
        except Exception:
            pass
    return jsonify({"message": "if_account_exists_mail_sent"}), 200


@auth_bp.post("/forgot-password")
def forgot_password():
    """Trigger a password-reset email. Anti-enumeration: always 200."""
    body = request.get_json() or {}
    email = (body.get("email") or "").strip().lower()
    if email:
        try:
            auth_service.start_password_reset(email)
        except Exception:
            pass
    return jsonify({"message": "if_account_exists_mail_sent"}), 200


@auth_bp.post("/reset-password")
def reset_password():
    """Consume a reset token + new password. Body: {token, password}."""
    body = request.get_json() or {}
    token = (body.get("token") or "").strip()
    password = body.get("password") or ""
    if not token:
        return jsonify({"error": "missing_token"}), 400
    if len(password) < 8:
        return jsonify({"error": "weak_password", "message": "Password must be at least 8 characters."}), 400
    user = auth_service.complete_password_reset(token, password)
    if not user:
        return jsonify({"error": "invalid_or_expired_token"}), 400
    return jsonify({"email": user.email, "reset": True}), 200


@auth_bp.post("/login")
def login():
    try:
        data = _login_schema.load(request.get_json() or {})
    except ValidationError as e:
        return jsonify({"error": "validation_error", "detail": e.messages}), 400

    user = auth_service.authenticate_user(data["email"], data["password"])
    if not user:
        # Audit failed logins so the admin dashboard can surface brute-force
        # attempts. We log the email the attacker *tried* (no PII risk: it's
        # provided in the request) and the source IP. Best-effort: never let
        # an audit failure break a login response.
        try:
            admin_service.log_action(
                action="auth.login_failed",
                actor_id=None,
                target_type="user",
                target_id=None,
                detail={"email": data["email"]},
                ip_address=request.headers.get("X-Forwarded-For", request.remote_addr),
            )
        except Exception:
            pass
        return (
            jsonify(
                {"error": "invalid_credentials", "message": "Invalid email or password"}
            ),
            401,
        )

    if not user.email_verified:
        return (
            jsonify(
                {
                    "error": "email_not_verified",
                    "message": "Please verify your email before signing in.",
                    "email": user.email,
                }
            ),
            403,
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
