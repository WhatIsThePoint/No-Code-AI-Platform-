import hashlib
import secrets
from datetime import datetime, timezone

from flask import current_app
from flask_jwt_extended import create_access_token

from ..extensions import bcrypt, db
from ..models.user import RefreshToken, User
from . import mail_service


def register_user(
    email: str, password: str, full_name: str | None, role: str
) -> tuple[User, str | None]:
    """Create a user. When email verification is required, also generate a
    one-time token, persist its SHA-256 hash on the user row, and email the
    raw token-bearing link to MailHog. Returns (user, raw_token | None)."""
    if User.query.filter_by(email=email).first():
        raise ValueError("email_taken")

    cfg = current_app.config
    require_verify = cfg.get("EMAIL_VERIFICATION_REQUIRED", True)

    password_hash = bcrypt.generate_password_hash(password).decode("utf-8")
    user = User(
        email=email,
        password_hash=password_hash,
        full_name=full_name,
        role=role,
        email_verified=not require_verify,
    )

    raw_token = None
    if require_verify:
        raw_token = secrets.token_urlsafe(32)
        user.email_verification_token_hash = _hash_token(raw_token)
        user.email_verification_sent_at = datetime.now(timezone.utc)

    db.session.add(user)
    db.session.commit()

    if raw_token:
        link = f"{cfg['FRONTEND_URL']}/verify-email?token={raw_token}"
        try:
            mail_service.send_verification_email(
                to=email, full_name=full_name, link=link
            )
        except Exception:
            # Never let a mail failure break the registration response.
            pass

    return user, raw_token


def verify_email_token(raw_token: str) -> User | None:
    """Validate a verification token. Returns the user on success, clears the
    token on the row so it can't be replayed."""
    if not raw_token:
        return None
    token_hash = _hash_token(raw_token)
    user = User.query.filter_by(email_verification_token_hash=token_hash).first()
    if not user:
        return None

    sent_at = user.email_verification_sent_at
    if sent_at:
        sent_at = sent_at.replace(tzinfo=timezone.utc) if sent_at.tzinfo is None else sent_at
        age = (datetime.now(timezone.utc) - sent_at).total_seconds()
        if age > 24 * 3600:
            return None

    user.email_verified = True
    user.email_verification_token_hash = None
    db.session.commit()
    return user


def start_password_reset(email: str) -> bool:
    """Mint a fresh password-reset token and email the link. Always best-effort,
    never reveals whether the account exists. Returns whether a mail was sent."""
    user = User.query.filter(db.func.lower(User.email) == email.lower()).first()
    if not user:
        return False
    raw_token = secrets.token_urlsafe(32)
    user.password_reset_token_hash = _hash_token(raw_token)
    user.password_reset_sent_at = datetime.now(timezone.utc)
    db.session.commit()
    link = f"{current_app.config['FRONTEND_URL']}/reset-password?token={raw_token}"
    try:
        return mail_service.send_password_reset_email(
            to=user.email, full_name=user.full_name, link=link
        )
    except Exception:
        return False


def complete_password_reset(raw_token: str, new_password: str) -> User | None:
    """Validate a reset token, set the new bcrypt-hashed password, invalidate the
    token, and revoke every outstanding refresh token for that user."""
    if not raw_token:
        return None
    token_hash = _hash_token(raw_token)
    user = User.query.filter_by(password_reset_token_hash=token_hash).first()
    if not user:
        return None

    sent_at = user.password_reset_sent_at
    if sent_at:
        sent_at = sent_at.replace(tzinfo=timezone.utc) if sent_at.tzinfo is None else sent_at
        age = (datetime.now(timezone.utc) - sent_at).total_seconds()
        if age > 30 * 60:  # 30-minute TTL
            return None

    user.password_hash = bcrypt.generate_password_hash(new_password).decode("utf-8")
    user.password_reset_token_hash = None
    user.password_reset_sent_at = None
    # Any refresh token a session was sitting on becomes void — a stolen-laptop
    # scenario is the whole reason the user is resetting in the first place.
    for rt in RefreshToken.query.filter_by(user_id=user.id, revoked=False).all():
        rt.revoked = True
    db.session.commit()
    return user


def resend_verification_email(email: str) -> bool:
    """Mint a fresh verification token and re-email it. No-op if the account
    does not exist or is already verified. Returns whether a mail was sent."""
    user = User.query.filter(db.func.lower(User.email) == email.lower()).first()
    if not user or user.email_verified:
        return False
    raw_token = secrets.token_urlsafe(32)
    user.email_verification_token_hash = _hash_token(raw_token)
    user.email_verification_sent_at = datetime.now(timezone.utc)
    db.session.commit()
    link = f"{current_app.config['FRONTEND_URL']}/verify-email?token={raw_token}"
    try:
        return mail_service.send_verification_email(
            to=user.email, full_name=user.full_name, link=link
        )
    except Exception:
        return False


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
