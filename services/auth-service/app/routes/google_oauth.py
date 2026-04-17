"""
Google OAuth 2.0 flow for Calendar / Meet integration.

Graceful degradation: if GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET are not set,
all endpoints return 503 google_not_configured — matching the Stripe fallback
pattern used for Billing.
"""

from datetime import datetime, timedelta, timezone

from flask import Blueprint, current_app, jsonify, redirect, request
from flask_jwt_extended import get_jwt_identity, jwt_required

from ..extensions import db
from ..models.user import User

google_oauth_bp = Blueprint("google_oauth", __name__, url_prefix="/auth/google")

_SCOPES = [
    "https://www.googleapis.com/auth/calendar.events",
    "openid",
    "https://www.googleapis.com/auth/userinfo.email",
]


def _configured() -> bool:
    return bool(
        current_app.config.get("GOOGLE_CLIENT_ID")
        and current_app.config.get("GOOGLE_CLIENT_SECRET")
    )


def _build_flow(state: str | None = None):
    from google_auth_oauthlib.flow import Flow

    client_config = {
        "web": {
            "client_id": current_app.config["GOOGLE_CLIENT_ID"],
            "client_secret": current_app.config["GOOGLE_CLIENT_SECRET"],
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "redirect_uris": [current_app.config["GOOGLE_OAUTH_REDIRECT_URI"]],
        }
    }
    flow = Flow.from_client_config(client_config, scopes=_SCOPES, state=state)
    flow.redirect_uri = current_app.config["GOOGLE_OAUTH_REDIRECT_URI"]
    return flow


@google_oauth_bp.get("/link")
@jwt_required()
def get_consent_url():
    """Return a consent URL that includes the current user's id as OAuth `state`."""
    if not _configured():
        return jsonify({"error": "google_not_configured"}), 503

    user_id = get_jwt_identity()
    flow = _build_flow(state=user_id)
    auth_url, _state = flow.authorization_url(
        access_type="offline", include_granted_scopes="true", prompt="consent"
    )
    return jsonify({"authorization_url": auth_url}), 200


@google_oauth_bp.get("/callback")
def oauth_callback():
    """Exchange ?code= for tokens, persist refresh token on the user.

    This is a top-level browser redirect — no JWT header. We trust OAuth `state`
    (which we seeded with the user's id) to identify the user.
    """
    if not _configured():
        return jsonify({"error": "google_not_configured"}), 503

    code = request.args.get("code")
    state = request.args.get("state")
    if not code or not state:
        return jsonify({"error": "missing_code_or_state"}), 400

    user = User.query.get(state)
    if not user:
        return jsonify({"error": "unknown_user"}), 400

    flow = _build_flow(state=state)
    try:
        flow.fetch_token(code=code)
    except Exception as e:
        return jsonify({"error": "oauth_exchange_failed", "detail": str(e)}), 400

    creds = flow.credentials
    if creds.refresh_token:
        user.google_oauth_refresh_token = creds.refresh_token
    if creds.expiry:
        user.google_oauth_expires_at = creds.expiry.replace(tzinfo=timezone.utc)
    db.session.commit()

    # Redirect back to the frontend. Frontend route decides what to do next.
    frontend = current_app.config["FRONTEND_URL"].rstrip("/")
    return redirect(f"{frontend}/company?google_linked=1")


@google_oauth_bp.get("/status")
@jwt_required()
def link_status():
    """Report whether the current user has a Google refresh token on file."""
    user = User.query.get(get_jwt_identity())
    linked = bool(user and user.google_oauth_refresh_token)
    return (
        jsonify(
            {
                "configured": _configured(),
                "linked": linked,
            }
        ),
        200,
    )


@google_oauth_bp.delete("/unlink")
@jwt_required()
def unlink():
    user = User.query.get(get_jwt_identity())
    if user:
        user.google_oauth_refresh_token = None
        user.google_oauth_expires_at = None
        db.session.commit()
    return "", 204


# ─────────────────────────────────────────────────────────────────────────────
# Helper exposed to meetings route
# ─────────────────────────────────────────────────────────────────────────────


def build_calendar_service(user: User):
    """Build an authenticated Calendar API client for this user.

    Raises ValueError if the user has not linked Google, or RuntimeError if
    Google is not configured.
    """
    if not _configured():
        raise RuntimeError("google_not_configured")
    if not user.google_oauth_refresh_token:
        raise ValueError("google_not_linked")

    from google.oauth2.credentials import Credentials
    from googleapiclient.discovery import build

    creds = Credentials(
        token=None,
        refresh_token=user.google_oauth_refresh_token,
        token_uri="https://oauth2.googleapis.com/token",
        client_id=current_app.config["GOOGLE_CLIENT_ID"],
        client_secret=current_app.config["GOOGLE_CLIENT_SECRET"],
        scopes=_SCOPES,
    )
    service = build("calendar", "v3", credentials=creds, cache_discovery=False)

    # Track approximate expiry for diagnostics.
    user.google_oauth_expires_at = datetime.now(timezone.utc) + timedelta(minutes=55)
    db.session.commit()
    return service
