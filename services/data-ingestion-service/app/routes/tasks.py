from flask import Blueprint, jsonify

from ..extensions import mongo

tasks_bp = Blueprint("tasks", __name__)


@tasks_bp.get("/tasks/<task_id>/status")
def get_task_status(task_id):
    doc = mongo.get_collection("task_results").find_one(
        {"task_id": task_id}, {"_id": 0}
    )
    if not doc:
        # Fall back to Celery result backend (in case worker hasn't written to Mongo yet)
        from ..tasks.celery_app import celery
        result = celery.AsyncResult(task_id)
        return jsonify(
            {
                "task_id": task_id,
                "status": result.status.lower(),
                "progress_pct": 0,
                "error_message": str(result.result) if result.failed() else None,
            }
        ), 200

    # Normalize datetime fields
    for field in ("started_at", "completed_at", "created_at"):
        if doc.get(field) and hasattr(doc[field], "isoformat"):
            doc[field] = doc[field].isoformat()

    return jsonify(doc), 200
