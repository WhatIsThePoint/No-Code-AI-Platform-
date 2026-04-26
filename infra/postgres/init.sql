-- ============================================================
-- No-Code AI Platform — Auth Service Schema
-- ============================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Enable pgvector for RAG embeddings (Sprint 5 Module 2)
CREATE EXTENSION IF NOT EXISTS vector;

-- ── Users ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email           VARCHAR(255) UNIQUE NOT NULL,
    password_hash   VARCHAR(255) NOT NULL,
    full_name       VARCHAR(255),
    -- platform role: personal capability label
    role            VARCHAR(50) NOT NULL DEFAULT 'data_scientist'
                    CHECK (role IN ('data_scientist', 'engineer', 'analyst', 'super_admin')),
    -- billing tier
    tier            VARCHAR(50) NOT NULL DEFAULT 'free'
                    CHECK (tier IN ('free', 'solo', 'company', 'super_admin')),
    totp_secret     VARCHAR(64),          -- NULL = 2FA not set up
    totp_enabled    BOOLEAN NOT NULL DEFAULT FALSE,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    has_seen_pipeline_tour BOOLEAN NOT NULL DEFAULT FALSE,
    has_seen_genai_tour BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);

-- ── Refresh Tokens ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash  VARCHAR(255) NOT NULL UNIQUE,   -- SHA-256 of raw token
    expires_at  TIMESTAMPTZ NOT NULL,
    revoked     BOOLEAN NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user
    ON refresh_tokens (user_id, revoked, expires_at);

-- ── Companies ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS companies (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR(255) NOT NULL,
    slug        VARCHAR(100) UNIQUE NOT NULL,
    owner_id    UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_companies_owner ON companies (owner_id);

-- ── Memberships ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS memberships (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id  UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role        VARCHAR(50) NOT NULL DEFAULT 'viewer'
                CHECK (role IN ('owner', 'data_scientist', 'pm', 'analyst', 'viewer')),
    invited_by  UUID REFERENCES users(id) ON DELETE SET NULL,
    status      VARCHAR(20) NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'active', 'revoked')),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (company_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_memberships_company ON memberships (company_id, status);
CREATE INDEX IF NOT EXISTS idx_memberships_user    ON memberships (user_id, status);

-- ── Invitations ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS invitations (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id  UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    email       VARCHAR(255) NOT NULL,
    role        VARCHAR(50) NOT NULL DEFAULT 'viewer'
                CHECK (role IN ('data_scientist', 'pm', 'analyst', 'viewer')),
    token       VARCHAR(255) UNIQUE NOT NULL,
    expires_at  TIMESTAMPTZ NOT NULL,
    accepted    BOOLEAN NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invitations_token   ON invitations (token, accepted);
CREATE INDEX IF NOT EXISTS idx_invitations_company ON invitations (company_id);

-- ── updated_at trigger ────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_users_updated_at ON users;
CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── RAG: document_chunks (Sprint 5 Module 2) ─────────────────────────────────
-- 384-dim vectors match sentence-transformers/all-MiniLM-L6-v2.
CREATE TABLE IF NOT EXISTS document_chunks (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pipeline_id   VARCHAR(64) NOT NULL,
    document_id   VARCHAR(64),
    source_name   VARCHAR(512),
    chunk_index   INTEGER NOT NULL DEFAULT 0,
    text_content  TEXT NOT NULL,
    embedding     VECTOR(384) NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_document_chunks_pipeline
    ON document_chunks (pipeline_id);

-- IVFFlat cosine index — accelerates `embedding <=> :query` retrieval.
-- lists=100 is a sane default; tune up for larger corpora.
CREATE INDEX IF NOT EXISTS idx_document_chunks_embedding_cosine
    ON document_chunks USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);
