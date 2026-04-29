import uuid

from ..extensions import db


class Subscription(db.Model):
    __tablename__ = "subscriptions"

    id = db.Column(db.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = db.Column(
        db.UUID(as_uuid=True),
        db.ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )
    stripe_customer_id = db.Column(db.String(255), nullable=True, index=True)
    stripe_subscription_id = db.Column(db.String(255), nullable=True, index=True)
    # plan: free | solo_monthly | solo_yearly | company_monthly | company_yearly
    plan = db.Column(db.String(50), nullable=False, default="free")
    # status: active | trialing | past_due | canceled | incomplete
    status = db.Column(db.String(50), nullable=False, default="active")
    trial_end = db.Column(db.DateTime(timezone=True), nullable=True)
    current_period_end = db.Column(db.DateTime(timezone=True), nullable=True)

    # Per-user quota overrides written by super-admin. NULL means "use the
    # plan default" — surfaced to other services via /admin endpoints so they
    # can clamp RAG ingestion (max_chunks) and Ollama loads (max_vram_mb).
    max_chunks = db.Column(db.Integer, nullable=True)
    max_vram_mb = db.Column(db.Integer, nullable=True)

    created_at = db.Column(db.DateTime(timezone=True), server_default=db.func.now())
    updated_at = db.Column(
        db.DateTime(timezone=True),
        server_default=db.func.now(),
        onupdate=db.func.now(),
    )

    user = db.relationship("User", backref=db.backref("subscription", uselist=False))


# Plan → tier mapping
PLAN_TO_TIER = {
    "free": "free",
    "solo_monthly": "solo",
    "solo_yearly": "solo",
    "company_monthly": "company",
    "company_yearly": "company",
}


class AuditLog(db.Model):
    __tablename__ = "audit_logs"

    id = db.Column(db.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    actor_id = db.Column(
        db.UUID(as_uuid=True),
        db.ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    # action examples: auth.login, auth.register, admin.suspend_user, billing.subscribe
    action = db.Column(db.String(100), nullable=False, index=True)
    target_type = db.Column(
        db.String(50), nullable=True
    )  # user | company | subscription
    target_id = db.Column(db.String(255), nullable=True)
    detail = db.Column(db.JSON, nullable=True)
    ip_address = db.Column(db.String(50), nullable=True)
    created_at = db.Column(
        db.DateTime(timezone=True), server_default=db.func.now(), index=True
    )


class Announcement(db.Model):
    __tablename__ = "announcements"

    id = db.Column(db.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    created_by = db.Column(
        db.UUID(as_uuid=True),
        db.ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    title = db.Column(db.String(255), nullable=False)
    body = db.Column(db.Text, nullable=False)
    is_active = db.Column(db.Boolean, nullable=False, default=True)
    created_at = db.Column(db.DateTime(timezone=True), server_default=db.func.now())
    updated_at = db.Column(
        db.DateTime(timezone=True),
        server_default=db.func.now(),
        onupdate=db.func.now(),
    )
