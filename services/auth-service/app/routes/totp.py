from flask import Blueprint, current_app, jsonify, request
from flask_jwt_extended import decode_token, get_jwt_identity, jwt_required
from marshmallow import ValidationError

from ..extensions import db
from ..models.user import User
from ..schemas.auth import TotpSetupConfirmSchema, TotpVerifySchema
from ..services import auth_service, totp_service

totp_bp = Blueprint("totp", __name__, url_prefix="/auth/2fa")

_verify_schema = TotpVerifySchema()
_confirm_schema = TotpSetupConfirmSchema()


@totp_bp.post("/enable")
@jwt_required()
def enable_2fa():
    """Step 1: generate a TOTP secret and return QR code. Not yet activated."""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    if not user:
        return jsonify({"error": "user_not_found"}), 404

    secret = totp_service.generate_totp_secret()
    uri = totp_service.get_totp_uri(secret, user.email)
    qr_b64 = totp_service.get_qr_base64(uri)

    # Store secret temporarily (not yet enabled — needs confirm)
    user.totp_secret = secret
    db.session.commit()

    return jsonify({"secret": secret, "qr_uri": uri, "qr_image_base64": qr_b64}), 200


@totp_bp.post("/confirm")
@jwt_required()
def confirm_2fa():
    """Step 2: verify a TOTP code to activate 2FA."""
    try:
        data = _confirm_schema.load(request.get_json() or {})
    except ValidationError as e:
        return jsonify({"error": "validation_error", "detail": e.messages}), 400

    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    if not user or not user.totp_secret:
        return jsonify({"error": "2fa_not_initialized"}), 400

    if not totp_service.verify_totp(user.totp_secret, data["code"]):
        return jsonify({"error": "invalid_totp", "message": "Invalid TOTP code"}), 401

    user.totp_enabled = True
    db.session.commit()
    return jsonify({"message": "2fa_enabled"}), 200


@totp_bp.post("/verify")
def verify_2fa():
    """Used during login: validate session_token + TOTP code → issue real tokens."""
    try:
        data = _verify_schema.load(request.get_json() or {})
    except ValidationError as e:
        return jsonify({"error": "validation_error", "detail": e.messages}), 400

    # Decode session token (must have purpose=2fa_challenge)
    try:
        decoded = decode_token(data["session_token"])
    except Exception:
        return jsonify({"error": "invalid_session_token"}), 401

    if decoded.get("purpose") != "2fa_challenge":
        return jsonify({"error": "invalid_session_token"}), 401

    user = User.query.get(decoded["sub"])
    if not user or not user.totp_enabled or not user.totp_secret:
        return jsonify({"error": "invalid_session_token"}), 401

    if not totp_service.verify_totp(user.totp_secret, data["code"]):
        return jsonify({"error": "invalid_totp", "message": "Invalid TOTP code"}), 401

    from ..routes.auth import _set_refresh_cookie

    access_token, raw_refresh = auth_service.issue_tokens(user)
    resp = jsonify({"access_token": access_token, "token_type": "bearer"})
    _set_refresh_cookie(resp, raw_refresh)
    return resp, 200


@totp_bp.delete("/disable")
@jwt_required()
def disable_2fa():
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    if not user:
        return jsonify({"error": "user_not_found"}), 404

    user.totp_enabled = False
    user.totp_secret = None
    db.session.commit()
    return jsonify({"message": "2fa_disabled"}), 200
