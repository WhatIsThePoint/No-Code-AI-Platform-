import uuid

from ..extensions import db


class Company(db.Model):
    __tablename__ = "companies"

    id = db.Column(db.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = db.Column(db.String(255), nullable=False)
    slug = db.Column(db.String(100), unique=True, nullable=False)
    owner_id = db.Column(
        db.UUID(as_uuid=True),
        db.ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
    )
    created_at = db.Column(db.DateTime(timezone=True), server_default=db.func.now())

    memberships = db.relationship(
        "Membership", back_populates="company", cascade="all, delete-orphan"
    )
    invitations = db.relationship(
        "Invitation", back_populates="company", cascade="all, delete-orphan"
    )


class Membership(db.Model):
    __tablename__ = "memberships"

    id = db.Column(db.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = db.Column(
        db.UUID(as_uuid=True),
        db.ForeignKey("companies.id", ondelete="CASCADE"),
        nullable=False,
    )
    user_id = db.Column(
        db.UUID(as_uuid=True),
        db.ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    role = db.Column(db.String(50), nullable=False, default="viewer")
    invited_by = db.Column(
        db.UUID(as_uuid=True),
        db.ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    status = db.Column(db.String(20), nullable=False, default="pending")
    created_at = db.Column(db.DateTime(timezone=True), server_default=db.func.now())

    __table_args__ = (db.UniqueConstraint("company_id", "user_id"),)

    company = db.relationship("Company", back_populates="memberships")
    user = db.relationship("User", back_populates="memberships", foreign_keys=[user_id])


class Invitation(db.Model):
    __tablename__ = "invitations"

    id = db.Column(db.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = db.Column(
        db.UUID(as_uuid=True),
        db.ForeignKey("companies.id", ondelete="CASCADE"),
        nullable=False,
    )
    email = db.Column(db.String(255), nullable=False)
    role = db.Column(db.String(50), nullable=False, default="viewer")
    token = db.Column(db.String(255), unique=True, nullable=False)
    expires_at = db.Column(db.DateTime(timezone=True), nullable=False)
    accepted = db.Column(db.Boolean, nullable=False, default=False)
    created_at = db.Column(db.DateTime(timezone=True), server_default=db.func.now())

    company = db.relationship("Company", back_populates="invitations")
