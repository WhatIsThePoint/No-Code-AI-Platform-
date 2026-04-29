"""
Generic upstream proxy handler.
"""

import requests
from flask import (
    Blueprint,
    Response,
    current_app,
    g,
    jsonify,
    request,
    stream_with_context,
)
from flask_jwt_extended import get_jwt, get_jwt_identity, verify_jwt_in_request

from ..middleware.acl import require_project_access
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


@proxy_bp.route(
    "/pipelines/<pipeline_id>/meetings",
    methods=["GET", "POST"],
    endpoint="proxy_pipeline_meetings",
)
@require_project_access("read")
def proxy_pipeline_meetings(pipeline_id: str):
    """Meetings live on the auth-service (holds Google OAuth tokens)."""
    upstream = current_app.config["AUTH_SERVICE_URL"]
    return _forward(upstream, f"/pipelines/{pipeline_id}/meetings", require_auth=False)


@proxy_bp.route(
    "/pipelines/<pipeline_id>/meetings/external",
    methods=["POST"],
    endpoint="proxy_pipeline_meetings_external",
)
@require_project_access("read")
def proxy_pipeline_meetings_external(pipeline_id: str):
    """Non-Google fallback: share an existing Zoom/Teams/Jitsi/Whereby URL."""
    upstream = current_app.config["AUTH_SERVICE_URL"]
    return _forward(
        upstream,
        f"/pipelines/{pipeline_id}/meetings/external",
        require_auth=False,
    )


# ── RAG (Sprint 5 Module 2) ──────────────────────────────────────────────────


@proxy_bp.route(
    "/pipelines/<pipeline_id>/documents",
    methods=["GET", "POST"],
    endpoint="proxy_pipeline_documents",
)
@require_project_access("write")
def proxy_pipeline_documents(pipeline_id: str):
    """RAG document ingestion lives on the data-ingestion service."""
    upstream = current_app.config["DATA_SERVICE_URL"]
    return _forward(
        upstream, f"/pipelines/{pipeline_id}/documents", require_auth=False
    )


@proxy_bp.route(
    "/pipelines/<pipeline_id>/documents/<document_id>/chunks",
    methods=["GET"],
    endpoint="proxy_pipeline_document_chunks",
)
@require_project_access("read")
def proxy_pipeline_document_chunks(pipeline_id: str, document_id: str):
    """Per-document chunk preview — also on data-ingestion (pgvector reads).

    Registered BEFORE the catch-all /pipelines/<id>/<subpath> route so it
    short-circuits there and we don't route chunk requests to ml-training.
    """
    upstream = current_app.config["DATA_SERVICE_URL"]
    return _forward(
        upstream,
        f"/pipelines/{pipeline_id}/documents/{document_id}/chunks",
        require_auth=False,
    )


@proxy_bp.route(
    "/pipelines/<pipeline_id>/chat",
    methods=["POST"],
    endpoint="proxy_pipeline_chat",
)
@require_project_access("read")
def proxy_pipeline_chat(pipeline_id: str):
    """RAG inference: ML service runs Ollama + pgvector retrieval."""
    upstream = current_app.config["ML_SERVICE_URL"]
    # Ollama generation on CPU/GTX 1660 can take up to ~90s for llama3.2:3b —
    # give the gateway a longer read deadline than the default 30s.
    return _forward(
        upstream, f"/pipelines/{pipeline_id}/chat", require_auth=False, timeout=150
    )


@proxy_bp.route(
    "/pipelines/<pipeline_id>/chat/stream",
    methods=["POST"],
    endpoint="proxy_pipeline_chat_stream",
)
@require_project_access("read")
def proxy_pipeline_chat_stream(pipeline_id: str):
    """
    Streaming RAG inference. Cannot reuse _forward() because that helper
    buffers `resp.content` before returning — which defeats the point.
    Here we open the upstream socket and pump iter_content straight to the
    client via stream_with_context.
    """
    upstream = current_app.config["ML_SERVICE_URL"].rstrip("/")
    url = f"{upstream}/pipelines/{pipeline_id}/chat/stream"

    headers = {
        k: v
        for k, v in request.headers
        if k.lower() not in _HOP_BY_HOP
        and k.lower() != "host"
        and not k.lower().startswith(("x-user-", "x-company-", "x-project-"))
    }
    headers.update(get_forwarded_headers())

    try:
        upstream_resp = requests.post(
            url,
            headers=headers,
            data=request.get_data(),
            stream=True,
            timeout=180,
        )
    except requests.exceptions.ConnectionError:
        return jsonify({"error": "upstream_unavailable"}), 503
    except requests.exceptions.Timeout:
        return jsonify({"error": "upstream_timeout"}), 504

    def relay():
        try:
            for chunk in upstream_resp.iter_content(chunk_size=None):
                if chunk:
                    yield chunk
        finally:
            upstream_resp.close()

    excluded = _HOP_BY_HOP | {"content-length"}
    response_headers = [
        (k, v) for k, v in upstream_resp.headers.items() if k.lower() not in excluded
    ]
    # Ensure no buffering at any hop.
    response_headers.append(("X-Accel-Buffering", "no"))
    response_headers.append(("Cache-Control", "no-cache"))

    return Response(
        stream_with_context(relay()),
        status=upstream_resp.status_code,
        headers=response_headers,
        content_type=upstream_resp.headers.get(
            "content-type", "application/x-ndjson"
        ),
    )


@proxy_bp.route(
    "/pipelines/<pipeline_id>/chat/history",
    methods=["GET"],
    endpoint="proxy_pipeline_chat_history",
)
@require_project_access("read")
def proxy_pipeline_chat_history(pipeline_id: str):
    upstream = current_app.config["ML_SERVICE_URL"]
    return _forward(
        upstream, f"/pipelines/{pipeline_id}/chat/history", require_auth=False
    )


@proxy_bp.route(
    "/pipelines/<pipeline_id>/chat/threads",
    methods=["GET", "POST"],
    endpoint="proxy_pipeline_chat_threads",
)
@require_project_access("read")
def proxy_pipeline_chat_threads(pipeline_id: str):
    upstream = current_app.config["ML_SERVICE_URL"]
    return _forward(
        upstream, f"/pipelines/{pipeline_id}/chat/threads", require_auth=False
    )


@proxy_bp.route(
    "/pipelines/<pipeline_id>/chat/threads/<thread_id>",
    methods=["GET", "DELETE"],
    endpoint="proxy_pipeline_chat_thread_detail",
)
@require_project_access("read")
def proxy_pipeline_chat_thread_detail(pipeline_id: str, thread_id: str):
    upstream = current_app.config["ML_SERVICE_URL"]
    return _forward(
        upstream,
        f"/pipelines/{pipeline_id}/chat/threads/{thread_id}",
        require_auth=False,
    )


@proxy_bp.route("/pipelines", methods=["GET", "POST"])
def proxy_pipelines_collection():
    """List + create. ACL is per-project; collection routes have no project to gate."""
    upstream = current_app.config["ML_SERVICE_URL"]
    return _forward(upstream, "/pipelines", require_auth=True)


# ── Sprint 7 Module 1: model export ───────────────────────────────────────────


@proxy_bp.route(
    "/pipelines/<pipeline_id>/export/<kind>",
    methods=["GET"],
    endpoint="proxy_pipeline_export",
)
@require_project_access("read")
def proxy_pipeline_export(pipeline_id: str, kind: str):
    if kind not in ("tabular", "genai"):
        return jsonify({"error": "invalid_export_kind"}), 400
    upstream = current_app.config["ML_SERVICE_URL"]
    # Zip generation is in-memory but can be a few hundred MB for large
    # estimators — bump the read deadline above the default 30s.
    return _forward(
        upstream,
        f"/pipelines/{pipeline_id}/export/{kind}",
        require_auth=False,
        timeout=120,
    )


@proxy_bp.route(
    "/pipelines/<pipeline_id>", methods=["GET", "PUT", "PATCH", "DELETE"]
)
@require_project_access("read")  # mutating verbs still pass; upstream + auth gate the writes
def proxy_pipeline_single(pipeline_id: str):
    upstream = current_app.config["ML_SERVICE_URL"]
    return _forward(upstream, f"/pipelines/{pipeline_id}", require_auth=False)


@proxy_bp.route(
    "/pipelines/<pipeline_id>/<path:subpath>",
    methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
)
@require_project_access("read")
def proxy_pipeline_subroute(pipeline_id: str, subpath: str):
    upstream = current_app.config["ML_SERVICE_URL"]
    return _forward(
        upstream, f"/pipelines/{pipeline_id}/{subpath}", require_auth=False
    )


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


# ── Sprint 6: project ACL & member management ────────────────────────────────


@proxy_bp.route(
    "/projects/<project_id>/members",
    methods=["GET", "POST"],
    endpoint="proxy_project_members",
)
def proxy_project_members(project_id: str):
    upstream = current_app.config["AUTH_SERVICE_URL"]
    return _forward(
        upstream, f"/projects/{project_id}/members", require_auth=True
    )


@proxy_bp.route(
    "/projects/<project_id>/members/<user_id>",
    methods=["DELETE"],
    endpoint="proxy_project_member_delete",
)
def proxy_project_member_delete(project_id: str, user_id: str):
    upstream = current_app.config["AUTH_SERVICE_URL"]
    return _forward(
        upstream,
        f"/projects/{project_id}/members/{user_id}",
        require_auth=True,
    )


# ── Public: active announcements ──────────────────────────────────────────────


@proxy_bp.route("/announcements", methods=["GET"])
def proxy_announcements_public():
    upstream = current_app.config["AUTH_SERVICE_URL"]
    return _forward(upstream, "/billing/announcements", require_auth=False)


def _forward(
    upstream_base: str,
    path: str,
    require_auth: bool = True,
    timeout: int = 30,
) -> Response:
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

    # Forward headers (strip hop-by-hop + any client-supplied X-User-* /
    # X-Company-* / X-Project-* headers, then add our own authoritative ones).
    _STRIP_PREFIXES = ("x-user-", "x-company-", "x-project-")
    headers = {
        k: v
        for k, v in request.headers
        if k.lower() not in _HOP_BY_HOP
        and k.lower() != "host"
        and not k.lower().startswith(_STRIP_PREFIXES)
    }
    if require_auth or hasattr(g, "user_id"):
        headers.update(get_forwarded_headers())

    try:
        resp = requests.request(
            method=request.method,
            url=url,
            headers=headers,
            data=request.get_data(),
            cookies=request.cookies,
            allow_redirects=False,
            timeout=timeout,
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
