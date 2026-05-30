import os
from datetime import timedelta


class Config:
    # Flask
    SECRET_KEY = os.environ["JWT_SECRET_KEY"]
    TESTING = False

    # SQLAlchemy
    SQLALCHEMY_DATABASE_URI = os.environ["DATABASE_URL"]
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    # JWT
    JWT_SECRET_KEY = os.environ["JWT_SECRET_KEY"]
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(
        seconds=int(os.environ.get("JWT_ACCESS_TOKEN_EXPIRES", 900))
    )
    JWT_REFRESH_TOKEN_EXPIRES = timedelta(
        seconds=int(os.environ.get("JWT_REFRESH_TOKEN_EXPIRES", 2592000))
    )
    JWT_TOKEN_LOCATION = ["headers"]
    JWT_HEADER_NAME = "Authorization"
    JWT_HEADER_TYPE = "Bearer"

    # Redis
    REDIS_URL = os.environ.get("REDIS_URL", "redis://localhost:6379/0")

    # TOTP session TTL (seconds)
    TOTP_SESSION_TTL = 300

    # Stripe
    STRIPE_SECRET_KEY = os.environ.get("STRIPE_SECRET_KEY", "")
    STRIPE_PUBLISHABLE_KEY = os.environ.get("STRIPE_PUBLISHABLE_KEY", "")
    STRIPE_WEBHOOK_SECRET = os.environ.get("STRIPE_WEBHOOK_SECRET", "")
    FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:5173")

    # Outbound mail (MailHog in dev). If MAIL_SERVER is unset, send_mail is a no-op.
    MAIL_SERVER = os.environ.get("MAIL_SERVER", "")
    MAIL_PORT = int(os.environ.get("MAIL_PORT", "1025"))
    MAIL_FROM = os.environ.get("MAIL_FROM", "no-reply@nocode-ai.local")
    MAIL_USE_TLS = os.environ.get("MAIL_USE_TLS", "false").lower() == "true"
    MAIL_USERNAME = os.environ.get("MAIL_USERNAME", "")
    MAIL_PASSWORD = os.environ.get("MAIL_PASSWORD", "")
    # When false, /auth/register short-circuits to verified=True (for tests / seed users).
    EMAIL_VERIFICATION_REQUIRED = (
        os.environ.get("EMAIL_VERIFICATION_REQUIRED", "true").lower() == "true"
    )

    # Google OAuth (Meet + Calendar). All optional — if absent, endpoints
    # return 503 google_not_configured and the UI disables the Meet button.
    GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID", "")
    GOOGLE_CLIENT_SECRET = os.environ.get("GOOGLE_CLIENT_SECRET", "")
    GOOGLE_OAUTH_REDIRECT_URI = os.environ.get(
        "GOOGLE_OAUTH_REDIRECT_URI",
        "http://localhost:8000/auth/google/callback",
    )


class TestingConfig(Config):
    TESTING = True
    SQLALCHEMY_DATABASE_URI = os.environ.get(
        "DATABASE_URL", "postgresql://test:test@localhost:5432/test_auth"
    )
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(minutes=5)
