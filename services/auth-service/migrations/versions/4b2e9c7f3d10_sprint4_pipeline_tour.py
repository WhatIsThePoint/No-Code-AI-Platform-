"""sprint4: has_seen_pipeline_tour flag

Revision ID: 4b2e9c7f3d10
Revises: 3a7f8d9e1b2c
Create Date: 2026-04-15 00:00:00.000000

"""

import sqlalchemy as sa
from alembic import op

revision = "4b2e9c7f3d10"
down_revision = "3a7f8d9e1b2c"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "users",
        sa.Column(
            "has_seen_pipeline_tour",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
    )


def downgrade():
    op.drop_column("users", "has_seen_pipeline_tour")
