"""
JWT validation middleware helpers.

The gateway uses flask-jwt-extended to decode tokens.
After decoding, user identity and claims are injected as
request headers before forwarding upstream.
"""

from functools import wraps

from flask import g, jsonify
from flask_jwt_extended import get_jwt, get_jwt_identity, verify_jwt_in_request


def inject_user_headers(fn):
    """Decorator: require valid JWT and inject X-User-* headers into g for forwarding."""

    @wraps(fn)
    def wrapper(*args, **kwargs):
        try:
            verify_jwt_in_request()
        except Exception as e:
            return jsonify({"error": "unauthorized", "message": str(e)}), 401

        claims = get_jwt()
        g.user_id = get_jwt_identity()
        g.user_role = claims.get("role", "")
        g.user_tier = claims.get("tier", "free")
        return fn(*args, **kwargs)

    return wrapper


def get_forwarded_headers() -> dict:
    """Build the headers to add when forwarding to upstream services."""
    headers = {}
    if hasattr(g, "user_id") and g.user_id:
        headers["X-User-Id"] = str(g.user_id)
    if hasattr(g, "user_role") and g.user_role:
        headers["X-User-Role"] = g.user_role
    if hasattr(g, "user_tier") and g.user_tier:
        headers["X-User-Tier"] = g.user_tier
    return headers
