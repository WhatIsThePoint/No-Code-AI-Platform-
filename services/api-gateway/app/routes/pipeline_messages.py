"""GET /pipelines/<id>/messages — chat history for the pipeline room."""

from flask import Blueprint, current_app, g, jsonify, request
from flask_jwt_extended import get_jwt, get_jwt_identity, jwt_required
from sqlalchemy import text

from ..extensions import get_session

pipeline_messages_bp = Blueprint("pipeline_messages", __name__)


@pipeline_messages_bp.get("/pipelines/<pipeline_id>/messages")
@jwt_required()
def list_pipeline_messages(pipeline_id: str):
    user_id = get_jwt_identity()
    claims = get_jwt()
    tier = claims.get("tier") or ""
    if tier not in ("company", "super_admin"):
        return jsonify({"error": "company_tier_required"}), 403

    try:
        limit = min(int(request.args.get("limit", 50)), 200)
    except ValueError:
        limit = 50

    db = get_session()
    try:
        # Resolve active membership company_id
        membership = db.execute(
            text(
                "SELECT company_id::text AS cid FROM memberships "
                "WHERE user_id = :uid AND status = 'active' LIMIT 1"
            ),
            {"uid": user_id},
        ).mappings().first()
        if not membership:
            return jsonify({"error": "no_company_membership"}), 403

        rows = db.execute(
            text(
                "SELECT m.id::text AS id, m.pipeline_id, m.user_id::text AS user_id, "
                "       m.message, m.created_at, u.full_name, u.email "
                "FROM pipeline_messages m "
                "LEFT JOIN users u ON u.id = m.user_id "
                "WHERE m.pipeline_id = :pid AND m.company_id = :cid "
                "ORDER BY m.created_at DESC "
                "LIMIT :lim"
            ),
            {"pid": pipeline_id, "cid": membership["cid"], "lim": limit},
        ).mappings().all()
    finally:
        db.close()

    # Return ascending (oldest → newest) so the UI can append normally.
    items = [
        {
            "id": r["id"],
            "pipeline_id": r["pipeline_id"],
            "user_id": r["user_id"],
            "full_name": r["full_name"] or r["email"],
            "message": r["message"],
            "created_at": r["created_at"].isoformat() if r["created_at"] else None,
        }
        for r in reversed(rows)
    ]
    return jsonify({"items": items}), 200


# Silence unused-import warning for shared g module
_ = g
_ = current_app
