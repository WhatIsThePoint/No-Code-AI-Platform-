"""email verification on signup

Revision ID: ab8e6f4d3c60
Revises: 9a7d5e3c2b50
Create Date: 2026-05-29 00:00:00.000000

Adds three nullable columns to `users` so a fresh signup can be gated by an
email-link verification round-trip via MailHog:

  email_verified                  — bool, default false
  email_verification_token_hash   — sha256 of the one-time token (raw token
                                    is only ever in the outbound email)
  email_verification_sent_at      — last time a verification mail was sent;
                                    used to enforce the 24-hour TTL.

Existing rows (seed users, demo accounts) are backfilled to verified=true so
the demo seed data continues to work without re-running a manual click-through.

Idempotent — safe to re-run on an already-migrated DB.
"""

import sqlalchemy as sa
from alembic import op

revision = "ab8e6f4d3c60"
down_revision = "9a7d5e3c2b50"
branch_labels = None
depends_on = None


def _has_column(table: str, column: str) -> bool:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    return any(c["name"] == column for c in inspector.get_columns(table))


def upgrade():
    if not _has_column("users", "email_verified"):
        op.add_column(
            "users",
            sa.Column(
                "email_verified",
                sa.Boolean(),
                nullable=False,
                server_default=sa.false(),
            ),
        )
    if not _has_column("users", "email_verification_token_hash"):
        op.add_column(
            "users",
            sa.Column(
                "email_verification_token_hash", sa.String(length=255), nullable=True
            ),
        )
        op.create_index(
            "ix_users_email_verification_token_hash",
            "users",
            ["email_verification_token_hash"],
        )
    if not _has_column("users", "email_verification_sent_at"):
        op.add_column(
            "users",
            sa.Column(
                "email_verification_sent_at",
                sa.DateTime(timezone=True),
                nullable=True,
            ),
        )

    # Backfill: existing users (seed accounts, demo accounts already in use)
    # are treated as verified so they keep working.
    op.execute("UPDATE users SET email_verified = TRUE WHERE email_verified IS FALSE")


def downgrade():
    if _has_column("users", "email_verification_sent_at"):
        op.drop_column("users", "email_verification_sent_at")
    if _has_column("users", "email_verification_token_hash"):
        op.drop_index(
            "ix_users_email_verification_token_hash", table_name="users"
        )
        op.drop_column("users", "email_verification_token_hash")
    if _has_column("users", "email_verified"):
        op.drop_column("users", "email_verified")
