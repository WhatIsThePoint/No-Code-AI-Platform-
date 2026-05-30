"""password reset tokens

Revision ID: bc9f7a5d4e70
Revises: ab8e6f4d3c60
Create Date: 2026-05-29 00:00:00.000000

Adds two columns to `users` to support a click-through password reset round
trip via MailHog:

  password_reset_token_hash   — sha256 of the one-time reset token
  password_reset_sent_at      — last time a reset mail was sent; used for the
                                30-minute token TTL.

Idempotent — safe to re-run on an already-migrated DB.
"""

import sqlalchemy as sa
from alembic import op

revision = "bc9f7a5d4e70"
down_revision = "ab8e6f4d3c60"
branch_labels = None
depends_on = None


def _has_column(table: str, column: str) -> bool:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    return any(c["name"] == column for c in inspector.get_columns(table))


def upgrade():
    if not _has_column("users", "password_reset_token_hash"):
        op.add_column(
            "users",
            sa.Column(
                "password_reset_token_hash", sa.String(length=255), nullable=True
            ),
        )
        op.create_index(
            "ix_users_password_reset_token_hash",
            "users",
            ["password_reset_token_hash"],
        )
    if not _has_column("users", "password_reset_sent_at"):
        op.add_column(
            "users",
            sa.Column(
                "password_reset_sent_at",
                sa.DateTime(timezone=True),
                nullable=True,
            ),
        )


def downgrade():
    if _has_column("users", "password_reset_sent_at"):
        op.drop_column("users", "password_reset_sent_at")
    if _has_column("users", "password_reset_token_hash"):
        op.drop_index(
            "ix_users_password_reset_token_hash", table_name="users"
        )
        op.drop_column("users", "password_reset_token_hash")
