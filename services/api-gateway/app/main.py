import os

import redis as redis_client
from flask import Flask, jsonify
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from flask_limiter import Limiter

from .config import Config, TestingConfig


def create_app(config=None):
    app = Flask(__name__)

    if config:
        app.config.from_object(config)
    elif os.environ.get("FLASK_ENV") == "testing":
        app.config.from_object(TestingConfig)
    else:
        app.config.from_object(Config)

    # CORS — only for gateway
    CORS(app, origins=app.config["CORS_ORIGINS"], supports_credentials=True)

    # JWT (decode-only — auth-service issues tokens)
    jwt = JWTManager(app)

    # Rate limiter backed by Redis
    redis_url = app.config["REDIS_URL"]
    limiter = Limiter(
        app=app,
        key_func=_rate_limit_key,
        default_limits=["600 per minute"],
        storage_uri=redis_url,
    )

    # Redis for token blacklist checks
    _redis = redis_client.from_url(redis_url, decode_responses=True)
    app.extensions["redis"] = _redis
    app.extensions["limiter"] = limiter

    @jwt.token_in_blocklist_loader
    def check_blacklist(jwt_header, jwt_payload):
        jti = jwt_payload["jti"]
        return _redis.exists(f"blacklist:token:{jti}") == 1

    @jwt.revoked_token_loader
    def revoked_response(jwt_header, jwt_payload):
        return jsonify({"error": "token_revoked"}), 401

    @jwt.expired_token_loader
    def expired_response(jwt_header, jwt_payload):
        return jsonify({"error": "token_expired"}), 401

    @jwt.invalid_token_loader
    def invalid_response(error):
        return jsonify({"error": "invalid_token", "message": str(error)}), 401

    @jwt.unauthorized_loader
    def unauthorized_response(error):
        return jsonify({"error": "missing_token"}), 401

    # Register routes
    from .routes.auth import auth_bp
    from .routes.health import health_bp
    from .routes.proxy import proxy_bp

    app.register_blueprint(health_bp)
    app.register_blueprint(auth_bp)
    app.register_blueprint(proxy_bp)

    return app


def _rate_limit_key():
    """Use user ID from JWT if available, else remote IP."""
    try:
        from flask_jwt_extended import get_jwt_identity, verify_jwt_in_request

        verify_jwt_in_request(optional=True)
        identity = get_jwt_identity()
        if identity:
            return f"user:{identity}"
    except Exception:
        pass
    from flask import request

    return request.remote_addr
