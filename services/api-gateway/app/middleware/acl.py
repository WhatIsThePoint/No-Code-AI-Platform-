"""Sprint 6 — gateway-level project ACL.

Flow per request to /pipelines/<id>/...:
  1. Gateway has already verified the JWT (auth.py).
  2. We GET the project's ACL meta (owner_type, owner_id, company_id) from
     ml-training-service via its unauthenticated `_acl-meta` endpoint.
  3. We POST to auth-service `/acl/projects/check` to resolve the user's role
     for the requested permission.
  4. On allow → stash role + company_id on `g` so `_forward` includes them as
     X-Company-Id / X-Project-Role headers when proxying upstream.
  5. On deny → 403 immediately, no upstream call.

Failure modes are conservative: any 5xx or network error from either service
returns 503 (don't leak data on partial failure).
"""

from __future__ import annotations

from functools import wraps

import requests
from flask import current_app, g, jsonify
from flask_jwt_extended import get_jwt, get_jwt_identity, verify_jwt_in_request


_ACL_META_TIMEOUT = 5
_ACL_CHECK_TIMEOUT = 5


def _fetch_pipeline_meta(pipeline_id: str) -> tuple[dict | None, tuple | None]:
    ml_url = current_app.config["ML_SERVICE_URL"]
    try:
        resp = requests.get(
            f"{ml_url.rstrip('/')}/pipelines/{pipeline_id}/_acl-meta",
            timeout=_ACL_META_TIMEOUT,
        )
    except requests.RequestException:
        return None, (jsonify({"error": "upstream_unavailable"}), 503)
    if resp.status_code == 404:
        return None, (jsonify({"error": "not_found"}), 404)
    if resp.status_code != 200:
        return None, (jsonify({"error": "acl_meta_failed"}), 503)
    return resp.json(), None


def _check_acl(
    *,
    user_id: str,
    project_id: str,
    owner_type: str,
    project_owner_id: str,
    company_id: str | None,
    permission: str,
) -> tuple[dict | None, tuple | None]:
    auth_url = current_app.config["AUTH_SERVICE_URL"]
    try:
        resp = requests.post(
            f"{auth_url.rstrip('/')}/acl/projects/check",
            json={
                "user_id": user_id,
                "project_id": project_id,
                "owner_type": owner_type,
                "project_owner_id": project_owner_id,
                "company_id": company_id,
                "permission": permission,
            },
            timeout=_ACL_CHECK_TIMEOUT,
        )
    except requests.RequestException:
        return None, (jsonify({"error": "acl_unavailable"}), 503)
    if resp.status_code != 200:
        return None, (jsonify({"error": "acl_check_failed"}), 503)
    return resp.json(), None


def require_project_access(permission: str = "read"):
    """Decorator: enforce ACL on routes carrying a `pipeline_id` URL kwarg."""

    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            try:
                verify_jwt_in_request()
            except Exception as e:
                return jsonify({"error": "unauthorized", "message": str(e)}), 401

            user_id = str(get_jwt_identity())
            claims = get_jwt()
            g.user_id = user_id
            g.user_role = claims.get("role", "")
            g.user_tier = claims.get("tier", "free")

            pipeline_id = kwargs.get("pipeline_id") or kwargs.get("subpath")
            if not pipeline_id:
                return jsonify({"error": "pipeline_id_required"}), 400
            # subpath may be "<id>/foo/bar" — first segment is the pipeline id.
            pipeline_id = pipeline_id.split("/", 1)[0]

            meta, err = _fetch_pipeline_meta(pipeline_id)
            if err:
                return err

            decision, err = _check_acl(
                user_id=user_id,
                project_id=pipeline_id,
                owner_type=meta.get("owner_type") or "personal",
                project_owner_id=meta.get("user_id") or "",
                company_id=meta.get("company_id"),
                permission=permission,
            )
            if err:
                return err
            if not decision.get("allowed"):
                return (
                    jsonify(
                        {"error": "forbidden", "reason": decision.get("reason")}
                    ),
                    403,
                )

            # Enrich forwarded headers with the resolved project context so the
            # upstream service's _can_access mirror passes.
            g.project_role = decision.get("role")
            g.project_company_id = meta.get("company_id")

            return fn(*args, **kwargs)

        return wrapper

    return decorator
