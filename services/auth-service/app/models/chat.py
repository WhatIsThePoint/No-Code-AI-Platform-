import uuid

from ..extensions import db


class PipelineMessage(db.Model):
    __tablename__ = "pipeline_messages"

    id = db.Column(db.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    pipeline_id = db.Column(db.String(64), nullable=False)
    user_id = db.Column(
        db.UUID(as_uuid=True),
        db.ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    company_id = db.Column(
        db.UUID(as_uuid=True),
        db.ForeignKey("companies.id", ondelete="CASCADE"),
        nullable=False,
    )
    message = db.Column(db.Text, nullable=False)
    created_at = db.Column(
        db.DateTime(timezone=True), server_default=db.func.now(), nullable=False
    )

    __table_args__ = (
        db.Index("ix_pipeline_messages_pipeline_created", "pipeline_id", "created_at"),
    )


class Meeting(db.Model):
    __tablename__ = "meetings"

    id = db.Column(db.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    pipeline_id = db.Column(db.String(64), nullable=False, index=True)
    created_by = db.Column(
        db.UUID(as_uuid=True),
        db.ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    company_id = db.Column(
        db.UUID(as_uuid=True),
        db.ForeignKey("companies.id", ondelete="CASCADE"),
        nullable=True,
    )
    hangout_link = db.Column(db.String(512), nullable=False)
    calendar_event_id = db.Column(db.String(255), nullable=True)
    start_at = db.Column(db.DateTime(timezone=True), nullable=True)
    end_at = db.Column(db.DateTime(timezone=True), nullable=True)
    created_at = db.Column(
        db.DateTime(timezone=True), server_default=db.func.now(), nullable=False
    )
