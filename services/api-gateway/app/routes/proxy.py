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


@proxy_bp.route("/datasets/<path:subpath>", methods=["GET", "POST", "PUT", "PATCH", "DELETE"])
def proxy_data(subpath):
    upstream = current_app.config["DATA_SERVICE_URL"]
    # Upload endpoint has a tighter rate limit (handled in data-ingestion-service)
    return _forward(upstream, f"/datasets/{subpath}", require_auth=True)


@proxy_bp.route("/tasks/<path:subpath>", methods=["GET"])
def proxy_tasks(subpath):
    upstream = current_app.config["DATA_SERVICE_URL"]
    return _forward(upstream, f"/tasks/{subpath}", require_auth=True)


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
