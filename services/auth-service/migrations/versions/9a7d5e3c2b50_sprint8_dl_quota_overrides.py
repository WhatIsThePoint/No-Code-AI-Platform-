"""sprint8: per-user DL quota overrides on subscriptions

Revision ID: 9a7d5e3c2b50
Revises: 8f6c4d2b1a40
Create Date: 2026-04-30 00:00:00.000000

Sprint 8 introduced image-classification training (dl-training-service).
This migration adds two nullable integer columns to `subscriptions` so
super-admins can clamp the per-tier ceilings on a per-user basis:

  max_dl_epochs       — caps `epochs` accepted by /dl/train
  max_dl_batch_size   — caps `batch_size` accepted by /dl/train

NULL means "use the plan default" (free=5/32, solo=20/64, company=50/128 —
the actual table-driven defaults live in app.services.plan_limits).

Idempotent — re-running on an already-migrated DB is safe.
"""

import sqlalchemy as sa
from alembic import op

revision = "9a7d5e3c2b50"
down_revision = "8f6c4d2b1a40"
branch_labels = None
depends_on = None


def upgrade():
    op.execute(
        """
        ALTER TABLE subscriptions
            ADD COLUMN IF NOT EXISTS max_dl_epochs INTEGER,
            ADD COLUMN IF NOT EXISTS max_dl_batch_size INTEGER
        """
    )


def downgrade():
    op.execute(
        """
        ALTER TABLE subscriptions
            DROP COLUMN IF EXISTS max_dl_epochs,
            DROP COLUMN IF EXISTS max_dl_batch_size
        """
    )


# silence unused-import warning when alembic does its dynamic loading
_ = sa
