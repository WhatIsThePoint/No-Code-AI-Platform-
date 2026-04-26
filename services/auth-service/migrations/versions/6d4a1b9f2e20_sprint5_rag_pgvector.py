"""sprint5 module 2: pgvector extension, document_chunks, has_seen_genai_tour

Revision ID: 6d4a1b9f2e20
Revises: 5c3f0a8e2d15
Create Date: 2026-04-17 00:00:00.000000

Idempotent: re-running on a DB that already has the extension/table/column
is safe — every statement uses IF NOT EXISTS / checks pg_attribute first.
"""

import sqlalchemy as sa
from alembic import op

revision = "6d4a1b9f2e20"
down_revision = "5c3f0a8e2d15"
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()

    # 1. pgvector extension (the image is pgvector/pgvector:pg16, so this is available).
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")

    # 2. has_seen_genai_tour — guarded so we don't conflict with init.sql on fresh DBs.
    has_col = bind.execute(
        sa.text(
            """
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'users' AND column_name = 'has_seen_genai_tour'
            """
        )
    ).scalar()
    if not has_col:
        op.add_column(
            "users",
            sa.Column(
                "has_seen_genai_tour",
                sa.Boolean(),
                nullable=False,
                server_default=sa.false(),
            ),
        )

    # 3. document_chunks table.
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS document_chunks (
            id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            pipeline_id   VARCHAR(64) NOT NULL,
            document_id   VARCHAR(64),
            source_name   VARCHAR(512),
            chunk_index   INTEGER NOT NULL DEFAULT 0,
            text_content  TEXT NOT NULL,
            embedding     VECTOR(384) NOT NULL,
            created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
        )
        """
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS idx_document_chunks_pipeline "
        "ON document_chunks (pipeline_id)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS idx_document_chunks_embedding_cosine "
        "ON document_chunks USING ivfflat (embedding vector_cosine_ops) "
        "WITH (lists = 100)"
    )


def downgrade():
    op.execute("DROP INDEX IF EXISTS idx_document_chunks_embedding_cosine")
    op.execute("DROP INDEX IF EXISTS idx_document_chunks_pipeline")
    op.execute("DROP TABLE IF EXISTS document_chunks")
    op.drop_column("users", "has_seen_genai_tour")
    # We deliberately do NOT drop the vector extension — other databases
    # in the cluster might rely on it.
