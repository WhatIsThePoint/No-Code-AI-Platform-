"""
Create a Google Meet-backed meeting for a pipeline via Calendar API,
persist it, and notify the pipeline room over SocketIO.
"""

import uuid
from datetime import datetime, timedelta, timezone

from flask import Blueprint, current_app, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required
from marshmallow import Schema, ValidationError, fields

from ..extensions import db
from ..models.chat import Meeting
from ..models.company import Membership
from ..models.user import User
from .google_oauth import build_calendar_service

meetings_bp = Blueprint("meetings", __name__, url_prefix="/pipelines")


class CreateMeetingSchema(Schema):
    title = fields.Str(load_default="Pipeline Collab Session")
    duration_minutes = fields.Int(load_default=30)


_create_schema = CreateMeetingSchema()


@meetings_bp.post("/<pipeline_id>/meetings")
@jwt_required()
def create_meeting(pipeline_id: str):
    try:
        data = _create_schema.load(request.get_json(silent=True) or {})
    except ValidationError as e:
        return jsonify({"error": "validation_error", "detail": e.messages}), 400

    user = User.query.get(get_jwt_identity())
    if not user:
        return jsonify({"error": "user_not_found"}), 404

    membership = Membership.query.filter_by(
        user_id=user.id, status="active"
    ).first()
    if not membership:
        return jsonify({"error": "forbidden", "message": "company_only"}), 403

    try:
        service = build_calendar_service(user)
    except RuntimeError:
        return jsonify({"error": "google_not_configured"}), 503
    except ValueError:
        return jsonify({"error": "google_not_linked"}), 428

    start = datetime.now(timezone.utc) + timedelta(minutes=1)
    end = start + timedelta(minutes=int(data["duration_minutes"]))
    event_body = {
        "summary": data["title"],
        "description": f"Pipeline collaboration session for {pipeline_id}",
        "start": {"dateTime": start.isoformat()},
        "end": {"dateTime": end.isoformat()},
        "conferenceData": {
            "createRequest": {
                "requestId": str(uuid.uuid4()),
                "conferenceSolutionKey": {"type": "hangoutsMeet"},
            }
        },
    }

    try:
        created = (
            service.events()
            .insert(calendarId="primary", body=event_body, conferenceDataVersion=1)
            .execute()
        )
    except Exception as e:
        return (
            jsonify({"error": "calendar_api_failed", "detail": str(e)}),
            502,
        )

    hangout_link = (
        created.get("hangoutLink")
        or _extract_meet_uri_from_conference_data(created.get("conferenceData"))
        or ""
    )

    meeting = Meeting(
        id=uuid.uuid4(),
        pipeline_id=pipeline_id,
        created_by=user.id,
        company_id=membership.company_id,
        hangout_link=hangout_link,
        calendar_event_id=created.get("id"),
        start_at=start,
        end_at=end,
    )
    db.session.add(meeting)
    db.session.commit()

    payload = {
        "meeting_id": str(meeting.id),
        "pipeline_id": pipeline_id,
        "hangout_link": hangout_link,
        "created_by": str(user.id),
        "created_by_name": user.full_name or user.email,
        "start_at": start.isoformat(),
        "end_at": end.isoformat(),
    }

    # Broadcast via the api-gateway SocketIO instance (Redis message queue).
    _broadcast_meeting_created(pipeline_id, payload)

    return jsonify(payload), 201


@meetings_bp.get("/<pipeline_id>/meetings")
@jwt_required()
def list_meetings(pipeline_id: str):
    rows = (
        Meeting.query.filter_by(pipeline_id=pipeline_id)
        .order_by(Meeting.created_at.desc())
        .limit(10)
        .all()
    )
    return (
        jsonify(
            [
                {
                    "meeting_id": str(m.id),
                    "pipeline_id": m.pipeline_id,
                    "hangout_link": m.hangout_link,
                    "created_by": str(m.created_by),
                    "created_at": m.created_at.isoformat() if m.created_at else None,
                }
                for m in rows
            ]
        ),
        200,
    )


def _extract_meet_uri_from_conference_data(conference_data):
    if not conference_data:
        return None
    for entry in conference_data.get("entryPoints", []) or []:
        if entry.get("entryPointType") == "video":
            return entry.get("uri")
    return None


def _broadcast_meeting_created(pipeline_id: str, payload: dict) -> None:
    """Publish meeting_created into the SocketIO room on the api-gateway.

    Uses a KombuManager/Redis message queue so we emit cross-process without
    needing a SocketIO server instance inside the auth-service.
    """
    try:
        import os

        from socketio import RedisManager

        queue = os.environ.get(
            "SOCKETIO_MESSAGE_QUEUE", "redis://redis:6379/2"
        )
        mgr = RedisManager(queue, write_only=True)
        mgr.emit(
            "meeting_created",
            payload,
            room=f"pipeline_{pipeline_id}",
        )
    except Exception as e:  # noqa: BLE001
        current_app.logger.warning("meeting_created broadcast failed: %s", e)
