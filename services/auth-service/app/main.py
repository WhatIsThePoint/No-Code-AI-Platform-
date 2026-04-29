
import os

import redis as redis_client
from flask import Flask, jsonify

from .config import Config, TestingConfig
from .extensions import bcrypt, db, jwt, ma, migrate


def create_app(config=None):
    from .observability import init_sentry

    init_sentry("auth-service")

    app = Flask(__name__)

    # Load config
    if config:
        app.config.from_object(config)
    elif os.environ.get("FLASK_ENV") == "testing":
        app.config.from_object(TestingConfig)
    else:
        app.config.from_object(Config)

    # Init extensions
    db.init_app(app)
    migrate.init_app(app, db)
    bcrypt.init_app(app)
    jwt.init_app(app)
    ma.init_app(app)

    # Redis for token blacklist
    _redis = redis_client.from_url(app.config["REDIS_URL"], decode_responses=True)

    @jwt.token_in_blocklist_loader
    def check_if_token_revoked(jwt_header, jwt_payload):
        jti = jwt_payload["jti"]
        return _redis.exists(f"blacklist:token:{jti}") == 1

    @jwt.revoked_token_loader
    def revoked_token_response(jwt_header, jwt_payload):
        return (
            jsonify({"error": "token_revoked", "message": "Token has been revoked"}),
            401,
        )

    @jwt.expired_token_loader
    def expired_token_response(jwt_header, jwt_payload):
        return jsonify({"error": "token_expired", "message": "Token has expired"}), 401

    @jwt.invalid_token_loader
    def invalid_token_response(error):
        return jsonify({"error": "invalid_token", "message": str(error)}), 401

    @jwt.unauthorized_loader
    def unauthorized_response(error):
        return jsonify({"error": "missing_token", "message": str(error)}), 401

    # Store redis on app for use in routes
    app.extensions["redis"] = _redis

    # Import models so Flask-Migrate can detect them
    from .models import chat, company, project_member, subscription, user  # noqa: F401

    # Register blueprints
    from .routes.admin import admin_bp
    from .routes.auth import auth_bp
    from .routes.billing import billing_bp
    from .routes.company import company_bp
    from .routes.google_oauth import google_oauth_bp
    from .routes.meetings import meetings_bp
    from .routes.profile import profile_bp
    from .routes.projects import projects_bp
    from .routes.totp import totp_bp

    app.register_blueprint(auth_bp)
    app.register_blueprint(totp_bp)
    app.register_blueprint(profile_bp)
    app.register_blueprint(company_bp)
    app.register_blueprint(admin_bp)
    app.register_blueprint(billing_bp)
    app.register_blueprint(google_oauth_bp)
    app.register_blueprint(meetings_bp)
    app.register_blueprint(projects_bp)

    @app.get("/health")
    def health():
        return jsonify({"status": "ok", "service": "auth-service"}), 200

    return app
