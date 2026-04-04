import uuid
from datetime import datetime, timezone

from flask import Blueprint, jsonify, request
from sqlalchemy import create_engine, text

from ..extensions import mongo
from ..services.storage_service import encrypt_value
from ..tasks.sql_import import import_from_sql

connector_bp = Blueprint("connector", __name__)


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
