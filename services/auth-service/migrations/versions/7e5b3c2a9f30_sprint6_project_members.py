"""sprint6: project_members ACL table

Revision ID: 7e5b3c2a9f30
Revises: 6d4a1b9f2e20
Create Date: 2026-04-18 00:00:00.000000

Two-tier project ACL (Sprint 6):
  - personal projects: no row needed (owner_id in pipeline doc is authoritative)
  - company projects: rows here + company_id match grant access
Role values: 'viewer' | 'editor' | 'admin' (admin = Project Manager)

Idempotent — re-running on an already-migrated DB is safe.
"""

import sqlalchemy as sa
from alembic import op

revision = "7e5b3c2a9f30"
down_revision = "6d4a1b9f2e20"
branch_labels = None
depends_on = None


def upgrade():
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS project_members (
            id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            project_id  VARCHAR(64) NOT NULL,
            user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            company_id  UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
            role        VARCHAR(20) NOT NULL DEFAULT 'viewer',
            granted_by  UUID REFERENCES users(id) ON DELETE SET NULL,
            created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
            UNIQUE (project_id, user_id)
        )
        """
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS idx_project_members_project "
        "ON project_members (project_id)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS idx_project_members_user "
        "ON project_members (user_id)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS idx_project_members_company "
        "ON project_members (company_id)"
    )

    bind = op.get_bind()
    has_check = bind.execute(
        sa.text(
            "SELECT 1 FROM information_schema.check_constraints "
            "WHERE constraint_name = 'project_members_role_check'"
        )
    ).scalar()
    if not has_check:
        op.execute(
            "ALTER TABLE project_members ADD CONSTRAINT project_members_role_check "
            "CHECK (role IN ('viewer', 'editor', 'admin'))"
        )


def downgrade():
    op.execute("DROP INDEX IF EXISTS idx_project_members_company")
    op.execute("DROP INDEX IF EXISTS idx_project_members_user")
    op.execute("DROP INDEX IF EXISTS idx_project_members_project")
    op.execute("DROP TABLE IF EXISTS project_members")
