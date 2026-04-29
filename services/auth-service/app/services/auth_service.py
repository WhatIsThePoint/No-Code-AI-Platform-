import hashlib
import secrets
from datetime import datetime, timezone

from flask import current_app
from flask_jwt_extended import create_access_token

from ..extensions import bcrypt, db
from ..models.user import RefreshToken, User


def register_user(email: str, password: str, full_name: str | None, role: str) -> User:
    if User.query.filter_by(email=email).first():
        raise ValueError("email_taken")

    password_hash = bcrypt.generate_password_hash(password).decode("utf-8")
    user = User(
        email=email, password_hash=password_hash, full_name=full_name, role=role
    )
    db.session.add(user)
    db.session.commit()
    return user


def authenticate_user(email: str, password: str) -> User | None:
    user = User.query.filter_by(email=email, is_active=True).first()
    if not user:
        return None
    if not bcrypt.check_password_hash(user.password_hash, password):
        return None
    return user


def issue_tokens(user: User) -> tuple[str, str]:
    """Return (access_token, refresh_token_raw)."""
    access_token = create_access_token(
        identity=str(user.id),
        additional_claims={"role": user.role, "tier": user.tier},
    )
    raw_refresh = secrets.token_hex(64)
    token_hash = _hash_token(raw_refresh)
    expires_at = (
        datetime.now(timezone.utc) + current_app.config["JWT_REFRESH_TOKEN_EXPIRES"]
    )

    rt = RefreshToken(user_id=user.id, token_hash=token_hash, expires_at=expires_at)
    db.session.add(rt)
    db.session.commit()

    return access_token, raw_refresh


def rotate_refresh_token(raw_token: str) -> tuple[str, str] | None:
    """Validate and rotate a refresh token. Returns (access_token, new_refresh_raw) or None."""
    token_hash = _hash_token(raw_token)
    rt = RefreshToken.query.filter_by(token_hash=token_hash, revoked=False).first()
    if not rt:
        return None
    if rt.expires_at.replace(tzinfo=timezone.utc) < datetime.now(timezone.utc):
        return None

    user = User.query.get(rt.user_id)
    if not user or not user.is_active:
        return None

    # Revoke old token
    rt.revoked = True
    db.session.flush()

    access_token, new_raw = issue_tokens(user)
    db.session.commit()
    return access_token, new_raw


def revoke_refresh_token(raw_token: str) -> None:
    token_hash = _hash_token(raw_token)
    rt = RefreshToken.query.filter_by(token_hash=token_hash).first()
    if rt:
        rt.revoked = True
        db.session.commit()


def blacklist_access_token(jti: str, exp: int) -> None:
    """Add access token JTI to Redis blacklist."""
    redis = current_app.extensions["redis"]
    now_ts = int(datetime.now(timezone.utc).timestamp())
    ttl = max(exp - now_ts, 1)
    redis.setex(f"blacklist:token:{jti}", ttl, "1")


def issue_2fa_session_token(user_id: str) -> str:
    """Issue a short-lived JWT specifically for the 2FA challenge step."""
    return create_access_token(
        identity=user_id,
        expires_delta=current_app.config.get("JWT_ACCESS_TOKEN_EXPIRES"),
        additional_claims={"purpose": "2fa_challenge"},
    )


# Hard ceiling on impersonation: 5 minutes. No refresh path. The super-admin
# explicitly re-impersonates if they need more time, generating a fresh audit
# row each time.
IMPERSONATION_TTL_SECONDS = 5 * 60


def issue_impersonation_token(target: User, actor_id: str) -> tuple[str, int]:
    """Mint a short-lived access token impersonating `target`.

    The `imp_actor` claim makes the token recognizably impersonated to every
    downstream service so audit logs can correlate the action back to the
    super-admin. No refresh-token row is created — this is a one-shot,
    non-renewable session.

    Returns (access_token, expires_in_seconds).
    """
    from datetime import timedelta

    delta = timedelta(seconds=IMPERSONATION_TTL_SECONDS)
    token = create_access_token(
        identity=str(target.id),
        expires_delta=delta,
        additional_claims={
            "role": target.role,
            "tier": target.tier,
            "imp_actor": str(actor_id),
        },
    )
    return token, IMPERSONATION_TTL_SECONDS


def _hash_token(raw: str) -> str:
    return hashlib.sha256(raw.encode()).hexdigest()
