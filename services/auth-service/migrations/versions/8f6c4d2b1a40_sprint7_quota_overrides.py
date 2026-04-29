"""sprint7: per-user quota overrides on subscriptions

Revision ID: 8f6c4d2b1a40
Revises: 7e5b3c2a9f30
Create Date: 2026-04-26 00:00:00.000000

Adds two nullable integer columns to the subscriptions table so super-admins
can clamp RAG ingestion (max_chunks) and Ollama loads (max_vram_mb) on a
per-user basis. NULL means "use the plan default" — services treat the
absence of an override as the canonical limit.

Idempotent — re-running on an already-migrated DB is safe.
"""

import sqlalchemy as sa
from alembic import op

revision = "8f6c4d2b1a40"
down_revision = "7e5b3c2a9f30"
branch_labels = None
depends_on = None


def upgrade():
    op.execute(
        """
        ALTER TABLE subscriptions
            ADD COLUMN IF NOT EXISTS max_chunks INTEGER,
            ADD COLUMN IF NOT EXISTS max_vram_mb INTEGER
        """
    )


def downgrade():
    op.execute(
        """
        ALTER TABLE subscriptions
            DROP COLUMN IF EXISTS max_chunks,
            DROP COLUMN IF EXISTS max_vram_mb
        """
    )


# silence unused-import warning when alembic does its dynamic loading
_ = sa
