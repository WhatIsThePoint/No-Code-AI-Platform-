import time
import uuid
from datetime import datetime, timezone

from flask import Blueprint, jsonify, request
from sqlalchemy import create_engine, text

from ..extensions import mongo
from ..services.storage_service import encrypt_value
from ..tasks.sql_import import import_from_sql

connector_bp = Blueprint("connector", __name__)


def _build_sql_connection_string(payload: dict) -> str | None:
    """Build a SQLAlchemy URL string from a connector payload, or None for unknown db_type."""
    db_type = payload.get("db_type")
    if db_type == "postgres":
        return (
            f"postgresql://{payload['username']}:{payload['password']}"
            f"@{payload['host']}:{payload['port']}/{payload['database']}"
        )
    if db_type == "mysql":
        return (
            f"mysql+pymysql://{payload['username']}:{payload['password']}"
            f"@{payload['host']}:{payload['port']}/{payload['database']}"
        )
    return None


@connector_bp.post("/datasets/sql-test")
def sql_test():
    """Probe-only sibling of /datasets/sql-connect.

    Opens a short-lived connection, runs `SELECT 1`, and lists up to 5 tables
    from the target schema so the wizard can preview what's available.
    Never persists credentials or creates a dataset row.
    """
    user_id = request.headers.get("X-User-Id")
    if not user_id:
        return jsonify({"error": "missing_user_id"}), 401

    data = request.get_json(silent=True) or {}
    required = ["db_type", "host", "port", "database", "username", "password"]
    for field in required:
        if field not in data:
            return (
                jsonify({"error": "validation_error", "detail": f"Missing field: {field}"}),
                400,
            )

    conn_str = _build_sql_connection_string(data)
    if conn_str is None:
        return jsonify({"error": "unsupported_db_type"}), 400

    started = time.perf_counter()
    try:
        engine = create_engine(conn_str, connect_args={"connect_timeout": 5})
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
            # Different dialects, different system tables. Try the standard
            # information_schema first; fall back to a lighter query if that
            # fails (some MySQL setups restrict access).
            try:
                rows = conn.execute(
                    text(
                        "SELECT table_name FROM information_schema.tables "
                        "WHERE table_schema = :schema "
                        "ORDER BY table_name LIMIT 5"
                    ),
                    {"schema": data["database"] if data["db_type"] == "mysql" else "public"},
                ).fetchall()
            except Exception:
                rows = []
        engine.dispose()
        latency_ms = round((time.perf_counter() - started) * 1000, 1)
    except Exception as exc:
        return (
            jsonify(
                {
                    "ok": False,
                    "error": "connection_failed",
                    "detail": str(exc)[:300],
                    "latency_ms": round((time.perf_counter() - started) * 1000, 1),
                }
            ),
            200,
        )

    return (
        jsonify(
            {
                "ok": True,
                "latency_ms": latency_ms,
                "samples": [r[0] for r in rows],
            }
        ),
        200,
    )


@connector_bp.post("/datasets/s3-test")
def s3_test():
    """Probe an S3 bucket — `boto3` HEAD on the bucket then list a few keys."""
    user_id = request.headers.get("X-User-Id")
    if not user_id:
        return jsonify({"error": "missing_user_id"}), 401

    data = request.get_json(silent=True) or {}
    required = ["bucket", "region", "access_key_id", "secret_access_key"]
    for field in required:
        if field not in data:
            return (
                jsonify({"error": "validation_error", "detail": f"Missing field: {field}"}),
                400,
            )

    started = time.perf_counter()
    try:
        import boto3
        from botocore.config import Config as BotoConfig
    except ImportError:
        return (
            jsonify(
                {
                    "ok": False,
                    "error": "boto3_missing",
                    "detail": "Install boto3 in the data-ingestion service to enable S3 connectors.",
                    "latency_ms": 0.0,
                }
            ),
            200,
        )

    try:
        s3 = boto3.client(
            "s3",
            region_name=data["region"],
            aws_access_key_id=data["access_key_id"],
            aws_secret_access_key=data["secret_access_key"],
            config=BotoConfig(connect_timeout=5, read_timeout=5, retries={"max_attempts": 1}),
        )
        s3.head_bucket(Bucket=data["bucket"])
        listing = s3.list_objects_v2(
            Bucket=data["bucket"],
            Prefix=data.get("prefix") or "",
            MaxKeys=5,
        )
        keys = [obj["Key"] for obj in listing.get("Contents", [])][:5]
        latency_ms = round((time.perf_counter() - started) * 1000, 1)
    except Exception as exc:
        return (
            jsonify(
                {
                    "ok": False,
                    "error": "connection_failed",
                    "detail": str(exc)[:300],
                    "latency_ms": round((time.perf_counter() - started) * 1000, 1),
                }
            ),
            200,
        )

    return jsonify({"ok": True, "latency_ms": latency_ms, "samples": keys}), 200


@connector_bp.post("/datasets/sql-connect")
def sql_connect():
    user_id = request.headers.get("X-User-Id")
    if not user_id:
        return jsonify({"error": "missing_user_id"}), 401

    data = request.get_json() or {}
    required = ["db_type", "host", "port", "database", "username", "password", "query"]
    for field in required:
        if field not in data:
            return (
                jsonify(
                    {"error": "validation_error", "detail": f"Missing field: {field}"}
                ),
                400,
            )

    # Test connection (timeout = 5s)
    db_type = data["db_type"]
    if db_type == "postgres":
        conn_str = (
            f"postgresql://{data['username']}:{data['password']}"
            f"@{data['host']}:{data['port']}/{data['database']}"
        )
    elif db_type == "mysql":
        conn_str = (
            f"mysql+pymysql://{data['username']}:{data['password']}"
            f"@{data['host']}:{data['port']}/{data['database']}"
        )
    else:
        return jsonify({"error": "unsupported_db_type"}), 400

    try:
        engine = create_engine(conn_str, connect_args={"connect_timeout": 5})
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
    except Exception as exc:
        return jsonify({"error": "connection_failed", "detail": str(exc)[:200]}), 400

    dataset_id = str(uuid.uuid4())
    company_id = data.get("company_id")
    description = (data.get("description") or "").strip() or None
    now = datetime.now(timezone.utc)

    # Encrypt password before storing
    encrypted_password = encrypt_value(data["password"])
    connector_config = {
        "db_type": db_type,
        "host": data["host"],
        "port": data["port"],
        "database": data["database"],
        "username": data["username"],
        "password_encrypted": encrypted_password,
        "query": data["query"],
    }

    doc = {
        "dataset_id": dataset_id,
        "user_id": user_id,
        "company_id": company_id,
        "name": f"SQL:{data['database']}/{db_type}",
        "description": description,
        "source_type": db_type,
        "file_path": "",
        "status": "uploaded",
        "sql_connector": connector_config,
        "created_at": now,
        "updated_at": now,
    }
    mongo.get_collection("datasets").insert_one(doc)

    task = import_from_sql.apply_async(
        args=[dataset_id, connector_config], queue="connectors"
    )

    mongo.get_collection("task_results").insert_one(
        {
            "task_id": task.id,
            "dataset_id": dataset_id,
            "task_type": "sql_import",
            "status": "pending",
            "progress_pct": 0,
            "created_at": now,
        }
    )

    return jsonify({"dataset_id": dataset_id, "task_id": task.id}), 202
