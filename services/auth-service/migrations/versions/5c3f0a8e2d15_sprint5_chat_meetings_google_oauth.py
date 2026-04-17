"""sprint5: pipeline_messages, meetings, google_oauth tokens

Revision ID: 5c3f0a8e2d15
Revises: 4b2e9c7f3d10
Create Date: 2026-04-16 00:00:00.000000

"""

import sqlalchemy as sa
from alembic import op

revision = "5c3f0a8e2d15"
down_revision = "4b2e9c7f3d10"
branch_labels = None
depends_on = None


def upgrade():
    # ── Google OAuth columns on users ─────────────────────────────────────
    op.add_column(
        "users",
        sa.Column("google_oauth_refresh_token", sa.Text(), nullable=True),
    )
    op.add_column(
        "users",
        sa.Column(
            "google_oauth_expires_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
    )

    # ── pipeline_messages table ───────────────────────────────────────────
    op.create_table(
        "pipeline_messages",
        sa.Column("id", sa.dialects.postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("pipeline_id", sa.String(length=64), nullable=False),
        sa.Column(
            "user_id",
            sa.dialects.postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "company_id",
            sa.dialects.postgresql.UUID(as_uuid=True),
            sa.ForeignKey("companies.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index(
        "ix_pipeline_messages_pipeline_created",
        "pipeline_messages",
        ["pipeline_id", "created_at"],
    )

    # ── meetings table ────────────────────────────────────────────────────
    op.create_table(
        "meetings",
        sa.Column("id", sa.dialects.postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("pipeline_id", sa.String(length=64), nullable=False, index=True),
        sa.Column(
            "created_by",
            sa.dialects.postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "company_id",
            sa.dialects.postgresql.UUID(as_uuid=True),
            sa.ForeignKey("companies.id", ondelete="CASCADE"),
            nullable=True,
        ),
        sa.Column("hangout_link", sa.String(length=512), nullable=False),
        sa.Column("calendar_event_id", sa.String(length=255), nullable=True),
        sa.Column("start_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("end_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )


def downgrade():
    op.drop_table("meetings")
    op.drop_index(
        "ix_pipeline_messages_pipeline_created", table_name="pipeline_messages"
    )
    op.drop_table("pipeline_messages")
    op.drop_column("users", "google_oauth_expires_at")
    op.drop_column("users", "google_oauth_refresh_token")
