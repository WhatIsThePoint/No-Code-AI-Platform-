import uuid

from ..extensions import db


class ProjectMember(db.Model):
    """ACL row: a user's access to a single pipeline (a.k.a. project).

    Pipelines themselves live in Mongo (owned by ml-training-service).
    `project_id` therefore stores the Mongo document id as a string.
    Roles: 'viewer' | 'editor' | 'admin'. role='admin' means the user is a
    Project Manager for that project and can manage its members.
    """

    __tablename__ = "project_members"

    id = db.Column(db.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id = db.Column(db.String(64), nullable=False, index=True)
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
    role = db.Column(db.String(20), nullable=False, default="viewer")
    granted_by = db.Column(
        db.UUID(as_uuid=True),
        db.ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    created_at = db.Column(db.DateTime(timezone=True), server_default=db.func.now())

    __table_args__ = (db.UniqueConstraint("project_id", "user_id"),)
