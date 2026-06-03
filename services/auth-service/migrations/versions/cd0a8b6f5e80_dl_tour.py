"""add has_seen_dl_tour flag

Revision ID: cd0a8b6f5e80
Revises: bc9f7a5d4e70
Create Date: 2026-06-03 00:00:00.000000

Adds a per-user "seen DL onboarding tour" flag so the Deep Learning canvas
gets the same Joyride bubbles the ML and GenAI canvases already have.

Idempotent — guarded with information_schema so re-running on a DB that
already has the column (e.g. fresh from init.sql) is safe.
"""

import sqlalchemy as sa
from alembic import op

revision = "cd0a8b6f5e80"
down_revision = "bc9f7a5d4e70"
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    has_col = bind.execute(
        sa.text(
            """
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'users' AND column_name = 'has_seen_dl_tour'
            """
        )
    ).scalar()
    if not has_col:
        op.add_column(
            "users",
            sa.Column(
                "has_seen_dl_tour",
                sa.Boolean(),
                nullable=False,
                server_default=sa.false(),
            ),
        )


def downgrade():
    op.drop_column("users", "has_seen_dl_tour")
