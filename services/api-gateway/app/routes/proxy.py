"""
Generic upstream proxy handler.
"""

import requests
from flask import Blueprint, Response, current_app, g, jsonify, request
from flask_jwt_extended import get_jwt, get_jwt_identity, verify_jwt_in_request

from ..middleware.auth import get_forwarded_headers

proxy_bp = Blueprint("proxy", __name__)

# Hop-by-hop headers that should not be forwarded
_HOP_BY_HOP = frozenset(
    [
        "connection",
        "keep-alive",
        "proxy-authenticate",
        "proxy-authorization",
        "te",
        "trailers",
        "transfer-encoding",
        "upgrade",
        "content-encoding",
    ]
)


@proxy_bp.route("/datasets", methods=["GET", "POST"])
@proxy_bp.route(
    "/datasets/<path:subpath>", methods=["GET", "POST", "PUT", "PATCH", "DELETE"]
)
def proxy_data(subpath=""):
    upstream = current_app.config["DATA_SERVICE_URL"]
    path = f"/datasets/{subpath}" if subpath else "/datasets"
    return _forward(upstream, path, require_auth=True)


@proxy_bp.route("/tasks/<path:subpath>", methods=["GET"])
def proxy_tasks(subpath):
    # Route training task status to ml-training-service, others to data-ingestion
    upstream = current_app.config["DATA_SERVICE_URL"]
    return _forward(upstream, f"/tasks/{subpath}", require_auth=True)


# ── ML Training Service routes ────────────────────────────────────────────────


@proxy_bp.route("/pipelines", methods=["GET", "POST"])
@proxy_bp.route(
    "/pipelines/<path:subpath>", methods=["GET", "POST", "PUT", "PATCH", "DELETE"]
)
def proxy_pipelines(subpath=""):
    upstream = current_app.config["ML_SERVICE_URL"]
    path = f"/pipelines/{subpath}" if subpath else "/pipelines"
    return _forward(upstream, path, require_auth=True)


@proxy_bp.route("/models/<path:subpath>", methods=["GET", "DELETE", "POST"])
def proxy_models(subpath):
    upstream = current_app.config["ML_SERVICE_URL"]
    return _forward(upstream, f"/models/{subpath}", require_auth=True)


# ── Auth-service: admin + billing routes ──────────────────────────────────────


@proxy_bp.route("/admin", methods=["GET"])
@proxy_bp.route("/admin/<path:subpath>", methods=["GET", "POST", "PATCH", "DELETE"])
def proxy_admin(subpath=""):
    upstream = current_app.config["AUTH_SERVICE_URL"]
    path = f"/admin/{subpath}" if subpath else "/admin"
    return _forward(upstream, path, require_auth=True)


@proxy_bp.route("/billing/plans", methods=["GET"])
def proxy_billing_plans():
    """Plans endpoint is public."""
    upstream = current_app.config["AUTH_SERVICE_URL"]
    return _forward(upstream, "/billing/plans", require_auth=False)


@proxy_bp.route("/billing/webhook", methods=["POST"])
def proxy_billing_webhook():
    """Webhook has no JWT — Stripe signs the payload instead."""
    upstream = current_app.config["AUTH_SERVICE_URL"]
    return _forward(upstream, "/billing/webhook", require_auth=False)


@proxy_bp.route("/billing/<path:subpath>", methods=["GET", "POST"])
def proxy_billing(subpath):
    upstream = current_app.config["AUTH_SERVICE_URL"]
    return _forward(upstream, f"/billing/{subpath}", require_auth=True)


# ── Public: active announcements ──────────────────────────────────────────────


@proxy_bp.route("/announcements", methods=["GET"])
def proxy_announcements_public():
    upstream = current_app.config["AUTH_SERVICE_URL"]
    return _forward(upstream, "/billing/announcements", require_auth=False)


def _forward(upstream_base: str, path: str, require_auth: bool = True) -> Response:
    """Forward the current request to an upstream service."""
    if require_auth:
        try:
            verify_jwt_in_request()
            claims = get_jwt()
            g.user_id = get_jwt_identity()
            g.user_role = claims.get("role", "")
            g.user_tier = claims.get("tier", "free")
        except Exception as e:
            return jsonify({"error": "unauthorized", "message": str(e)}), 401

    # Build upstream URL
    url = f"{upstream_base.rstrip('/')}{path}"
    if request.query_string:
        url += f"?{request.query_string.decode()}"

    # Forward headers (strip hop-by-hop, add X-User-* if authed)
    headers = {
        k: v
        for k, v in request.headers
        if k.lower() not in _HOP_BY_HOP and k.lower() != "host"
    }
    if require_auth:
        headers.update(get_forwarded_headers())

    try:
        resp = requests.request(
            method=request.method,
            url=url,
            headers=headers,
            data=request.get_data(),
            cookies=request.cookies,
            allow_redirects=False,
            timeout=30,
            stream=True,
        )
    except requests.exceptions.ConnectionError:
        return jsonify({"error": "upstream_unavailable"}), 503
    except requests.exceptions.Timeout:
        return jsonify({"error": "upstream_timeout"}), 504

    # Build response
    excluded_response_headers = _HOP_BY_HOP | {"content-length"}
    response_headers = [
        (k, v)
        for k, v in resp.headers.items()
        if k.lower() not in excluded_response_headers
    ]

    return Response(
        response=resp.content,
        status=resp.status_code,
        headers=response_headers,
        content_type=resp.headers.get("content-type", "application/json"),
    )
