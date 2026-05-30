"""
Auth routes: /auth/* and /users/me are proxied to the auth-service.
Public endpoints (register, login, refresh, invitation accept) skip JWT validation.
"""

from flask import Blueprint, current_app

from ..routes.proxy import _forward

auth_bp = Blueprint("auth_proxy", __name__)

# Routes that do NOT require a JWT to call
_PUBLIC_PREFIXES = (
    "/auth/register",
    "/auth/login",
    "/auth/refresh",
    "/auth/2fa/verify",
    "/auth/verify-email",
    "/auth/resend-verification",
    "/auth/forgot-password",
    "/auth/reset-password",
    "/auth/google/callback",
    "/invitations/accept/",
)


@auth_bp.route(
    "/auth/<path:subpath>", methods=["GET", "POST", "PUT", "PATCH", "DELETE"]
)
def proxy_auth(subpath):
    path = f"/auth/{subpath}"
    is_public = any(path.startswith(p) for p in _PUBLIC_PREFIXES)
    upstream = current_app.config["AUTH_SERVICE_URL"]
    return _forward(upstream, path, require_auth=not is_public)


@auth_bp.route(
    "/users/<path:subpath>", methods=["GET", "POST", "PUT", "PATCH", "DELETE"]
)
def proxy_users(subpath):
    upstream = current_app.config["AUTH_SERVICE_URL"]
    return _forward(upstream, f"/users/{subpath}", require_auth=True)


@auth_bp.route("/companies", methods=["GET", "POST"])
@auth_bp.route(
    "/companies/<path:subpath>", methods=["GET", "POST", "PUT", "PATCH", "DELETE"]
)
def proxy_companies(subpath=""):
    upstream = current_app.config["AUTH_SERVICE_URL"]
    path = f"/companies/{subpath}" if subpath else "/companies"
    return _forward(upstream, path, require_auth=True)


@auth_bp.route("/invitations/<path:subpath>", methods=["GET", "POST"])
def proxy_invitations(subpath):
    # auth-service mounts company_bp at /companies, so invitations live at /companies/invitations/
    path = f"/companies/invitations/{subpath}"
    is_public = subpath.startswith("accept/")
    upstream = current_app.config["AUTH_SERVICE_URL"]
    return _forward(upstream, path, require_auth=not is_public)
