"""
Admin Ops Console — live system telemetry endpoints.

Live panels back this blueprint:
  * /admin/system/queues  → Redis LLEN per known Celery queue
  * /admin/system/health  → infra healthcheck aggregator (Sprint 7 Module 5)
  * /admin/ollama/models  → list + delete Ollama model weights

Routes are registered BEFORE proxy_bp in main.py so Werkzeug's static-segment
routing wins over `/admin/<path:subpath>`. The hardware probe lives in
routes/system.py and is polled by the same admin panel.
"""

from __future__ import annotations

import os
import socket
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from urllib.parse import urlparse

import requests
from flask import Blueprint, Response, current_app, jsonify, request
from flask_jwt_extended import get_jwt, jwt_required

admin_ops_bp = Blueprint("admin_ops", __name__)

# Celery queues we ship: ingestion + connectors + rag (data-ingestion-worker)
# and training (ml-training-worker). Add to this list when a new queue lands.
KNOWN_QUEUES = ("ingestion", "connectors", "rag", "training")

OLLAMA_TIMEOUT = 5.0
HEALTHCHECK_TIMEOUT = 2.0  # per-probe wall-clock ceiling


def _require_admin():
    """Return None if caller is super_admin; otherwise a Flask 403 response."""
    claims = get_jwt()
    if claims.get("role") != "super_admin":
        return jsonify({"error": "forbidden", "message": "super_admin required"}), 403
    return None


# ── Celery queue depths ──────────────────────────────────────────────────────


@admin_ops_bp.get("/admin/system/queues")
@jwt_required()
def queue_depths():
    forbidden = _require_admin()
    if forbidden:
        return forbidden

    redis = current_app.extensions.get("redis")
    if redis is None:
        return jsonify({"error": "redis_unavailable", "queues": {}}), 503

    queues: dict[str, int | None] = {}
    redis_ok = True
    redis_error: str | None = None
    try:
        # Pipeline so we make one round trip rather than N.
        pipe = redis.pipeline()
        for name in KNOWN_QUEUES:
            pipe.llen(name)
        results = pipe.execute()
        for name, length in zip(KNOWN_QUEUES, results):
            try:
                queues[name] = int(length)
            except (TypeError, ValueError):
                queues[name] = None
    except Exception as exc:  # redis.exceptions.RedisError + ConnectionError
        redis_ok = False
        redis_error = str(exc)[:200]
        queues = {name: None for name in KNOWN_QUEUES}

    return (
        jsonify(
            {
                "redis_ok": redis_ok,
                "redis_error": redis_error,
                "queues": queues,
                "total_pending": sum(v for v in queues.values() if v is not None),
            }
        ),
        200,
    )


# ── Ollama registry ──────────────────────────────────────────────────────────


def _ollama_url() -> str:
    return current_app.config["OLLAMA_URL"].rstrip("/")


@admin_ops_bp.get("/admin/ollama/models")
@jwt_required()
def list_ollama_models():
    forbidden = _require_admin()
    if forbidden:
        return forbidden

    url = f"{_ollama_url()}/api/tags"
    try:
        resp = requests.get(url, timeout=OLLAMA_TIMEOUT)
        resp.raise_for_status()
    except requests.exceptions.ConnectionError:
        return jsonify({"error": "ollama_unreachable", "models": []}), 503
    except requests.exceptions.Timeout:
        return jsonify({"error": "ollama_timeout", "models": []}), 504
    except requests.exceptions.HTTPError as exc:
        return jsonify({"error": "ollama_error", "detail": str(exc)[:300]}), 502

    payload = resp.json() or {}
    raw_models = payload.get("models") or []
    # Normalize the shape so the frontend doesn't have to know Ollama's
    # response schema (which has changed across versions).
    models = []
    for m in raw_models:
        details = m.get("details") or {}
        models.append(
            {
                "name": m.get("name") or m.get("model"),
                "size_bytes": int(m.get("size") or 0),
                "modified_at": m.get("modified_at"),
                "digest": m.get("digest"),
                "family": details.get("family"),
                "parameter_size": details.get("parameter_size"),
                "quantization": details.get("quantization_level"),
            }
        )

    return jsonify({"models": models, "count": len(models)}), 200


# ── Infra healthcheck ────────────────────────────────────────────────────────


def _http_probe(name: str, base_url: str) -> dict:
    """Probe an HTTP `/health` endpoint with a strict timeout."""
    started = time.perf_counter()
    try:
        resp = requests.get(
            f"{base_url.rstrip('/')}/health", timeout=HEALTHCHECK_TIMEOUT
        )
        latency_ms = round((time.perf_counter() - started) * 1000, 1)
        if resp.status_code < 400:
            return {"service": name, "status": "up", "latency_ms": latency_ms}
        return {
            "service": name,
            "status": "down",
            "latency_ms": latency_ms,
            "message": f"HTTP {resp.status_code}",
        }
    except requests.exceptions.Timeout:
        return {
            "service": name,
            "status": "down",
            "latency_ms": round((time.perf_counter() - started) * 1000, 1),
            "message": "timeout",
        }
    except requests.exceptions.ConnectionError as exc:
        return {
            "service": name,
            "status": "down",
            "latency_ms": round((time.perf_counter() - started) * 1000, 1),
            "message": f"connection refused ({str(exc)[:80]})",
        }
    except Exception as exc:  # last-resort safety net so the aggregator never crashes
        return {
            "service": name,
            "status": "down",
            "latency_ms": round((time.perf_counter() - started) * 1000, 1),
            "message": str(exc)[:120],
        }


def _tcp_probe(name: str, host: str, port: int) -> dict:
    """Probe a TCP port. 'up' means the kernel accepted a SYN; sufficient for a
    liveness signal without dragging psycopg2 / pymongo into the gateway."""
    started = time.perf_counter()
    try:
        with socket.create_connection((host, port), timeout=HEALTHCHECK_TIMEOUT):
            pass
        return {
            "service": name,
            "status": "up",
            "latency_ms": round((time.perf_counter() - started) * 1000, 1),
        }
    except (socket.timeout, TimeoutError):
        return {
            "service": name,
            "status": "down",
            "latency_ms": round((time.perf_counter() - started) * 1000, 1),
            "message": "timeout",
        }
    except OSError as exc:
        return {
            "service": name,
            "status": "down",
            "latency_ms": round((time.perf_counter() - started) * 1000, 1),
            "message": str(exc)[:120],
        }


def _redis_probe() -> dict:
    """Real Redis PING via the gateway's already-loaded client."""
    started = time.perf_counter()
    redis = current_app.extensions.get("redis")
    if redis is None:
        return {
            "service": "redis",
            "status": "down",
            "latency_ms": 0.0,
            "message": "redis client not initialized",
        }
    try:
        redis.ping()
        return {
            "service": "redis",
            "status": "up",
            "latency_ms": round((time.perf_counter() - started) * 1000, 1),
        }
    except Exception as exc:
        return {
            "service": "redis",
            "status": "down",
            "latency_ms": round((time.perf_counter() - started) * 1000, 1),
            "message": str(exc)[:120],
        }


def _parse_host_port(url: str | None, default_host: str, default_port: int) -> tuple[str, int]:
    """Best-effort host:port extraction from a connection URL. Falls back to
    the docker-compose service names if parsing fails."""
    if not url:
        return default_host, default_port
    try:
        # Mongo URLs sometimes embed user:pass; urlparse handles both schemes.
        parsed = urlparse(url)
        host = parsed.hostname or default_host
        port = parsed.port or default_port
        return host, port
    except Exception:
        return default_host, default_port


@admin_ops_bp.get("/admin/users/<target_user_id>/export.zip")
@jwt_required()
def export_user_zip(target_user_id: str):
    """GDPR-style export: zip every per-user dump from every backend service.

    Fans out to:
      - auth-service /admin/users/<id>/export        (profile + audit + sub)
      - data-ingestion /admin/users/<id>/datasets    (dataset rows)
      - ml-training /admin/users/<id>/ml-data        (pipelines + models + chat)

    Each upstream is JSON; we wrap the four payloads + a manifest into one
    zip. Per-service failures degrade to an error stub inside the zip rather
    than aborting the whole export.
    """
    forbidden = _require_admin()
    if forbidden:
        return forbidden

    import io
    import json
    import zipfile
    from datetime import datetime, timezone

    from ..middleware.auth import get_forwarded_headers

    cfg = current_app.config
    headers = {"Accept": "application/json", **get_forwarded_headers()}
    # Authorization passes through unchanged so the upstream services see the
    # super-admin's JWT (auth-service uses it for its admin guard).
    auth_header = request.headers.get("Authorization")
    if auth_header:
        headers["Authorization"] = auth_header

    targets = [
        ("auth.json", f"{cfg['AUTH_SERVICE_URL'].rstrip('/')}/admin/users/{target_user_id}/export"),
        ("datasets.json", f"{cfg['DATA_SERVICE_URL'].rstrip('/')}/admin/users/{target_user_id}/datasets"),
        ("ml-data.json", f"{cfg['ML_SERVICE_URL'].rstrip('/')}/admin/users/{target_user_id}/ml-data"),
    ]

    pieces: dict[str, bytes] = {}
    errors: list[dict] = []
    for name, url in targets:
        try:
            resp = requests.get(url, headers=headers, timeout=10.0)
            if resp.status_code >= 400:
                errors.append({"file": name, "status": resp.status_code, "url": url})
                pieces[name] = json.dumps(
                    {"error": f"http_{resp.status_code}", "body": resp.text[:500]},
                    indent=2,
                ).encode("utf-8")
            else:
                # Re-pretty-print so the zip is human-readable.
                pieces[name] = json.dumps(resp.json(), indent=2, default=str).encode("utf-8")
        except Exception as exc:
            errors.append({"file": name, "error": str(exc)[:200], "url": url})
            pieces[name] = json.dumps({"error": str(exc)[:200]}, indent=2).encode("utf-8")

    manifest = {
        "user_id": target_user_id,
        "exported_at": datetime.now(timezone.utc).isoformat(),
        "files": list(pieces.keys()),
        "fetch_errors": errors,
    }

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("manifest.json", json.dumps(manifest, indent=2).encode("utf-8"))
        for name, blob in pieces.items():
            zf.writestr(name, blob)
        zf.writestr(
            "README.md",
            (
                "# GDPR data export\n\n"
                f"User: {target_user_id}\n"
                f"Exported: {manifest['exported_at']}\n\n"
                "Files:\n"
                "- `auth.json` — profile, subscription, audit log entries\n"
                "- `datasets.json` — uploaded datasets + profiling summaries\n"
                "- `ml-data.json` — pipelines, model versions, RAG chat turns\n"
                "- `manifest.json` — fetch metadata + any per-file errors\n"
            ).encode("utf-8"),
        )

    buf.seek(0)
    payload = buf.getvalue()
    safe_id = "".join(c if c.isalnum() or c in "._-" else "_" for c in target_user_id)
    filename = f"user_{safe_id}_export.zip"
    return Response(
        payload,
        status=200,
        mimetype="application/zip",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Content-Length": str(len(payload)),
            "Cache-Control": "no-store",
        },
    )


@admin_ops_bp.get("/admin/security/failed-logins")
@jwt_required()
def proxy_failed_logins():
    """Read-through proxy to the auth-service failed-login report."""
    forbidden = _require_admin()
    if forbidden:
        return forbidden
    upstream = current_app.config["AUTH_SERVICE_URL"].rstrip("/")
    try:
        auth_header = request.headers.get("Authorization", "")
        resp = requests.get(
            f"{upstream}/admin/security/failed-logins",
            params=request.args.to_dict(flat=True),
            headers={"Authorization": auth_header, "Accept": "application/json"},
            timeout=5.0,
        )
        return Response(resp.content, status=resp.status_code, mimetype="application/json")
    except requests.exceptions.RequestException as exc:
        return jsonify({"error": "upstream_unavailable", "detail": str(exc)[:200]}), 503


@admin_ops_bp.get("/admin/system/migration-drift")
@jwt_required()
def system_migration_drift():
    """Live migration-drift check — same diff logic as the CI script.

    Diffs the public-schema columns of the live `auth_db` (which is what the
    auth-service is currently using) against `infra/postgres/init.sql`. If
    `init.sql` declares a table/column that the live DB is missing, that's a
    "missed migration" or "stale init.sql" situation worth surfacing to the
    super-admin before it 500s an endpoint.

    The CI variant is more thorough (compares Alembic head against init.sql
    in a fresh DB). This one is read-only and doesn't need any extra DB
    privileges.
    """
    forbidden = _require_admin()
    if forbidden:
        return forbidden

    import re

    cfg = current_app.config

    # Tables that legitimately live in Alembic-only land (created by sprint
    # migrations, never declared in init.sql). Mirror of the CI script.
    alembic_only = {
        "alembic_version",
        "subscriptions",
        "audit_logs",
        "announcements",
        "project_members",
        "rag_documents",
        "rag_chunks",
        "document_chunks",
        "pipeline_messages",
        "meetings",
    }

    # Find init.sql relative to the gateway working directory. The repo
    # root isn't bind-mounted into the container in prod, so this only
    # works in dev/CI where the file is reachable. Fall back gracefully.
    init_paths = [
        os.path.join(os.environ.get("REPO_ROOT", "/repo"), "infra/postgres/init.sql"),
        "/app/infra/postgres/init.sql",
        os.path.join(os.path.dirname(__file__), "..", "..", "..", "..", "infra", "postgres", "init.sql"),
    ]
    init_sql_text = None
    for p in init_paths:
        try:
            with open(p, "r", encoding="utf-8") as fh:
                init_sql_text = fh.read()
                break
        except FileNotFoundError:
            continue
    if init_sql_text is None:
        return (
            jsonify(
                {
                    "status": "unavailable",
                    "message": "init.sql not reachable from this container",
                }
            ),
            200,
        )

    # Extract `CREATE TABLE [IF NOT EXISTS] name (... cols ...)` blocks.
    # This is intentionally lossy — we only need table + column names, not
    # the full DDL. The CI script does the rigorous version.
    tables_in_init: dict[str, set[str]] = {}
    pattern = re.compile(
        r"CREATE\s+TABLE(?:\s+IF\s+NOT\s+EXISTS)?\s+(\w+)\s*\((.+?)\)\s*;",
        re.IGNORECASE | re.DOTALL,
    )
    for match in pattern.finditer(init_sql_text):
        table = match.group(1).lower()
        body = match.group(2)
        cols: set[str] = set()
        # Strip parenthesised inner clauses (e.g. CHECK (...)) so commas
        # inside them don't split column definitions.
        depth = 0
        cleaned: list[str] = []
        for ch in body:
            if ch == "(":
                depth += 1
            elif ch == ")":
                depth -= 1
            elif ch == "," and depth == 0:
                cleaned.append("\x00")
                continue
            cleaned.append(ch)
        for raw in "".join(cleaned).split("\x00"):
            line = raw.strip()
            if not line:
                continue
            # Skip table-level constraints like UNIQUE(a,b) / CHECK / FOREIGN KEY / PRIMARY KEY.
            head = line.split()[0].upper()
            if head in {"UNIQUE", "CHECK", "FOREIGN", "PRIMARY", "CONSTRAINT", "EXCLUDE"}:
                continue
            col_name = line.split()[0].strip('"').lower()
            cols.add(col_name)
        tables_in_init[table] = cols

    # Pull the live schema via the existing SQLAlchemy session.
    from ..extensions import get_session
    from sqlalchemy import text

    db = get_session()
    try:
        rows = db.execute(
            text(
                "SELECT table_name, column_name "
                "FROM information_schema.columns "
                "WHERE table_schema='public'"
            )
        ).all()
    finally:
        db.close()

    tables_live: dict[str, set[str]] = {}
    for table_name, column_name in rows:
        tables_live.setdefault(table_name.lower(), set()).add(column_name.lower())

    # Diff (init vs live).
    only_in_init_tables = sorted(set(tables_in_init) - set(tables_live))
    only_in_live_tables = sorted(
        t for t in set(tables_live) - set(tables_in_init) if t not in alembic_only
    )

    column_diffs: list[dict] = []
    for table in sorted(set(tables_in_init) & set(tables_live)):
        only_init = sorted(tables_in_init[table] - tables_live[table])
        only_live = sorted(tables_live[table] - tables_in_init[table])
        if only_init or only_live:
            column_diffs.append(
                {
                    "table": table,
                    "only_in_init_sql": only_init,
                    "only_in_live_db": only_live,
                }
            )

    drift = bool(only_in_init_tables or only_in_live_tables or column_diffs)
    return (
        jsonify(
            {
                "status": "drift" if drift else "ok",
                "tables_only_in_init_sql": only_in_init_tables,
                "tables_only_in_live_db": only_in_live_tables,
                "column_diffs": column_diffs,
                "alembic_only_allowlist": sorted(alembic_only),
                "init_sql_source": next(p for p in init_paths if os.path.exists(p)),
            }
        ),
        200,
    )
    _ = cfg  # quiet linter: kept for future cross-service drift checks


@admin_ops_bp.get("/admin/system/health")
@jwt_required()
def system_health():
    """Aggregate infra healthchecks across the stack.

    All probes run in parallel with strict per-probe timeouts so the endpoint
    is bounded to ~`HEALTHCHECK_TIMEOUT` seconds wall-clock even if every
    backend is unresponsive. Individual probe failures degrade gracefully —
    we never raise out of the aggregator.
    """
    forbidden = _require_admin()
    if forbidden:
        return forbidden

    cfg = current_app.config

    pg_host, pg_port = _parse_host_port(cfg.get("DATABASE_URL"), "postgres", 5432)
    mongo_url = os.environ.get("MONGO_URL") or os.environ.get("MONGO_URI")
    mongo_host, mongo_port = _parse_host_port(mongo_url, "mongo", 27017)

    probes = [
        ("auth-service", lambda: _http_probe("auth-service", cfg["AUTH_SERVICE_URL"])),
        ("data-ingestion", lambda: _http_probe("data-ingestion", cfg["DATA_SERVICE_URL"])),
        ("ml-training", lambda: _http_probe("ml-training", cfg["ML_SERVICE_URL"])),
        ("postgres", lambda: _tcp_probe("postgres", pg_host, pg_port)),
        ("mongo", lambda: _tcp_probe("mongo", mongo_host, mongo_port)),
        ("redis", _redis_probe),
    ]

    results: dict[str, dict] = {}
    # Fan out so a slow service can't serialize ahead of fast ones.
    with ThreadPoolExecutor(max_workers=len(probes)) as pool:
        future_to_name = {pool.submit(fn): name for name, fn in probes}
        for future in as_completed(future_to_name):
            name = future_to_name[future]
            try:
                results[name] = future.result(timeout=HEALTHCHECK_TIMEOUT + 0.5)
            except Exception as exc:  # never let one bad probe surface as a 500
                results[name] = {
                    "service": name,
                    "status": "down",
                    "latency_ms": 0.0,
                    "message": f"probe crashed: {str(exc)[:100]}",
                }

    # Deterministic ordering: services first (HTTP), then datastores (TCP/PING).
    order = ["auth-service", "data-ingestion", "ml-training", "postgres", "mongo", "redis"]
    services = [results[name] for name in order if name in results]
    summary = {
        "checked_at": time.time(),
        "all_up": all(s["status"] == "up" for s in services),
        "up_count": sum(1 for s in services if s["status"] == "up"),
        "total": len(services),
        "services": services,
    }
    return jsonify(summary), 200


@admin_ops_bp.delete("/admin/ollama/models/<path:model_name>")
@jwt_required()
def delete_ollama_model(model_name: str):
    forbidden = _require_admin()
    if forbidden:
        return forbidden

    if not model_name or len(model_name) > 200:
        return jsonify({"error": "invalid_model_name"}), 400

    url = f"{_ollama_url()}/api/delete"
    try:
        resp = requests.delete(
            url, json={"name": model_name}, timeout=OLLAMA_TIMEOUT
        )
        # Ollama returns 200 on success and 404 if the model is unknown.
        if resp.status_code == 404:
            return jsonify({"error": "model_not_found", "name": model_name}), 404
        resp.raise_for_status()
    except requests.exceptions.ConnectionError:
        return jsonify({"error": "ollama_unreachable"}), 503
    except requests.exceptions.Timeout:
        return jsonify({"error": "ollama_timeout"}), 504
    except requests.exceptions.HTTPError as exc:
        return jsonify({"error": "ollama_error", "detail": str(exc)[:300]}), 502

    return jsonify({"deleted": model_name}), 200
