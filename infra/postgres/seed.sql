-- ============================================================
-- No-Code AI Platform — Demo Seed Data (Sprint 4)
-- ============================================================
-- Run via `make seed`.  All demo users share password: Demo1234!
-- Wipes existing demo data for a clean slate, then re-inserts.
-- ============================================================

DO $$
DECLARE
    -- bcrypt hash of "Demo1234!" (12 rounds)
    demo_pwd CONSTANT TEXT := '$2b$12$14VU7umhpn7pe3cLpvoAIOEOlucoNdACXYl0br12bKr6mTvHurIIC';

    -- Fixed UUIDs for deterministic seeding
    uid_admin  CONSTANT UUID := 'a0000000-0000-0000-0000-000000000001';
    uid_alice  CONSTANT UUID := 'a0000000-0000-0000-0000-000000000002';
    uid_bob    CONSTANT UUID := 'a0000000-0000-0000-0000-000000000003';
    uid_carol  CONSTANT UUID := 'a0000000-0000-0000-0000-000000000004';
    uid_dave   CONSTANT UUID := 'a0000000-0000-0000-0000-000000000005';
    uid_eve    CONSTANT UUID := 'a0000000-0000-0000-0000-000000000006';
    uid_frank  CONSTANT UUID := 'a0000000-0000-0000-0000-000000000007';
    -- Extended ACME team (to test member list / invite UI at scale)
    uid_grace  CONSTANT UUID := 'a0000000-0000-0000-0000-000000000008';
    uid_henry  CONSTANT UUID := 'a0000000-0000-0000-0000-000000000009';
    uid_iris   CONSTANT UUID := 'a0000000-0000-0000-0000-00000000000a';
    uid_jack   CONSTANT UUID := 'a0000000-0000-0000-0000-00000000000b';
    uid_kate   CONSTANT UUID := 'a0000000-0000-0000-0000-00000000000c';

    cid_acme   CONSTANT UUID := 'c0000000-0000-0000-0000-000000000001';
BEGIN
    -- ── Clean slate ───────────────────────────────────────────────────────
    -- Remove memberships and invitations for these users (any company)
    DELETE FROM invitations  WHERE company_id IN (SELECT id FROM companies WHERE owner_id IN (uid_admin, uid_alice, uid_bob, uid_carol, uid_dave, uid_eve, uid_frank, uid_grace, uid_henry, uid_iris, uid_jack, uid_kate));
    DELETE FROM memberships  WHERE company_id IN (SELECT id FROM companies WHERE owner_id IN (uid_admin, uid_alice, uid_bob, uid_carol, uid_dave, uid_eve, uid_frank, uid_grace, uid_henry, uid_iris, uid_jack, uid_kate));
    DELETE FROM memberships  WHERE user_id IN (uid_admin, uid_alice, uid_bob, uid_carol, uid_dave, uid_eve, uid_frank, uid_grace, uid_henry, uid_iris, uid_jack, uid_kate);
    -- Remove any companies owned by these users (FK: owner_id → users)
    DELETE FROM companies    WHERE owner_id IN (uid_admin, uid_alice, uid_bob, uid_carol, uid_dave, uid_eve, uid_frank, uid_grace, uid_henry, uid_iris, uid_jack, uid_kate);
    -- Now safe to delete users
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'subscriptions') THEN
        DELETE FROM subscriptions WHERE user_id IN (uid_admin, uid_alice, uid_bob, uid_carol, uid_dave, uid_eve, uid_frank, uid_grace, uid_henry, uid_iris, uid_jack, uid_kate);
    END IF;
    DELETE FROM refresh_tokens WHERE user_id IN (uid_admin, uid_alice, uid_bob, uid_carol, uid_dave, uid_eve, uid_frank, uid_grace, uid_henry, uid_iris, uid_jack, uid_kate);
    DELETE FROM users        WHERE id IN (uid_admin, uid_alice, uid_bob, uid_carol, uid_dave, uid_eve, uid_frank, uid_grace, uid_henry, uid_iris, uid_jack, uid_kate);

    -- ── Users ─────────────────────────────────────────────────────────────
    -- User roles:  data_scientist | engineer | analyst | super_admin
    -- Tiers:       free | solo | company | super_admin
    INSERT INTO users (id, email, password_hash, full_name, role, tier, totp_enabled, is_active, has_seen_pipeline_tour)
    VALUES
        -- Platform administrator
        (uid_admin, 'admin@nocode-ai.io',  demo_pwd, 'Platform Admin',  'super_admin',    'super_admin', FALSE, TRUE, TRUE),
        -- ACME ML company team (owner + active members)
        (uid_alice, 'alice@acme-ml.com',   demo_pwd, 'Alice Martin',    'data_scientist', 'company',     FALSE, TRUE, FALSE),
        (uid_bob,   'bob@acme-ml.com',     demo_pwd, 'Bob Chen',        'engineer',       'company',     FALSE, TRUE, FALSE),
        (uid_carol, 'carol@acme-ml.com',   demo_pwd, 'Carol Diaz',      'analyst',        'company',     FALSE, TRUE, FALSE),
        (uid_grace, 'grace@acme-ml.com',   demo_pwd, 'Grace Hopper',    'data_scientist', 'company',     FALSE, TRUE, TRUE),
        (uid_henry, 'henry@acme-ml.com',   demo_pwd, 'Henry Nguyen',    'engineer',       'company',     FALSE, TRUE, FALSE),
        (uid_iris,  'iris@acme-ml.com',    demo_pwd, 'Iris Patel',      'analyst',        'company',     FALSE, TRUE, TRUE),
        (uid_jack,  'jack@acme-ml.com',    demo_pwd, 'Jack Morales',    'data_scientist', 'company',     FALSE, TRUE, FALSE),
        (uid_kate,  'kate@acme-ml.com',    demo_pwd, 'Kate Williams',   'analyst',        'company',     FALSE, TRUE, FALSE),
        -- Solo practitioner
        (uid_dave,  'dave@solo-dev.io',    demo_pwd, 'Dave Solo',       'data_scientist', 'solo',        FALSE, TRUE, FALSE),
        -- Free-tier user
        (uid_eve,   'eve@free-mail.io',    demo_pwd, 'Eve Free',        'data_scientist', 'free',        FALSE, TRUE, FALSE),
        -- Pre-registered user with pending invite (demonstrates invite flow)
        (uid_frank, 'frank@acme-ml.com',   demo_pwd, 'Frank Torres',    'engineer',       'free',        FALSE, TRUE, FALSE);

    -- Demo accounts are pre-verified so they can sign in immediately (RG-01).
    UPDATE users SET email_verified = TRUE
    WHERE id IN (uid_admin, uid_alice, uid_bob, uid_carol, uid_dave, uid_eve,
                 uid_frank, uid_grace, uid_henry, uid_iris, uid_jack, uid_kate);

    -- ── Company ───────────────────────────────────────────────────────────
    INSERT INTO companies (id, name, slug, owner_id)
    VALUES (cid_acme, 'ACME Machine Learning', 'acme-ml', uid_alice);

    -- ── Memberships ───────────────────────────────────────────────────────
    -- Member roles:  owner | pm | data_scientist | analyst | viewer
    INSERT INTO memberships (company_id, user_id, role, invited_by, status)
    VALUES
        (cid_acme, uid_alice, 'owner',          NULL,      'active'),
        (cid_acme, uid_bob,   'pm',             uid_alice, 'active'),
        (cid_acme, uid_carol, 'analyst',        uid_alice, 'active'),
        (cid_acme, uid_grace, 'data_scientist', uid_alice, 'active'),
        (cid_acme, uid_henry, 'data_scientist', uid_alice, 'active'),
        (cid_acme, uid_iris,  'analyst',        uid_bob,   'active'),
        (cid_acme, uid_jack,  'data_scientist', uid_bob,   'active'),
        (cid_acme, uid_kate,  'viewer',         uid_alice, 'active');

    -- ── Pending invitation (Frank) ────────────────────────────────────────
    -- Frank is registered but hasn't accepted his company invite yet.
    -- Token: "demo-invite-frank" — accept via GET /companies/invitations/accept/demo-invite-frank
    INSERT INTO invitations (company_id, email, role, token, expires_at, accepted)
    VALUES (cid_acme, 'frank@acme-ml.com', 'data_scientist', 'demo-invite-frank', now() + INTERVAL '72 hours', FALSE);

    -- ── Subscriptions ─────────────────────────────────────────────────────
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'subscriptions') THEN
        INSERT INTO subscriptions (id, user_id, plan, status, current_period_end)
        VALUES
            (gen_random_uuid(), uid_admin, 'free',            'active', NULL),
            (gen_random_uuid(), uid_alice, 'company_monthly', 'active', now() + INTERVAL '30 days'),
            (gen_random_uuid(), uid_bob,   'company_monthly', 'active', now() + INTERVAL '30 days'),
            (gen_random_uuid(), uid_carol, 'company_monthly', 'active', now() + INTERVAL '30 days'),
            (gen_random_uuid(), uid_grace, 'company_monthly', 'active', now() + INTERVAL '30 days'),
            (gen_random_uuid(), uid_henry, 'company_monthly', 'active', now() + INTERVAL '30 days'),
            (gen_random_uuid(), uid_iris,  'company_monthly', 'active', now() + INTERVAL '30 days'),
            (gen_random_uuid(), uid_jack,  'company_monthly', 'active', now() + INTERVAL '30 days'),
            (gen_random_uuid(), uid_kate,  'company_monthly', 'active', now() + INTERVAL '30 days'),
            (gen_random_uuid(), uid_dave,  'solo_monthly',    'active', now() + INTERVAL '30 days'),
            (gen_random_uuid(), uid_eve,   'free',            'active', NULL),
            (gen_random_uuid(), uid_frank, 'free',            'active', NULL);
    END IF;

    -- ── Welcome Announcement ──────────────────────────────────────────────
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'announcements') THEN
        DELETE FROM announcements WHERE title = 'Welcome to NoCode AI';
        INSERT INTO announcements (id, created_by, title, body, is_active)
        VALUES (
            gen_random_uuid(),
            uid_admin,
            'Welcome to NoCode AI',
            'Upload datasets, build visual pipelines, train models, and explore SHAP explanations — all without writing code.',
            TRUE
        );
    END IF;

    RAISE NOTICE '────────────────────────────────────────────────────';
    RAISE NOTICE 'Seed complete: 12 users, 1 company, 8 memberships, 1 pending invite';
    RAISE NOTICE '';
    RAISE NOTICE 'Demo accounts (password: Demo1234! for all):';
    RAISE NOTICE '  admin@nocode-ai.io   — Super Admin';
    RAISE NOTICE '  alice@acme-ml.com    — ACME owner';
    RAISE NOTICE '  bob@acme-ml.com      — ACME pm';
    RAISE NOTICE '  carol@acme-ml.com    — ACME analyst';
    RAISE NOTICE '  grace@acme-ml.com    — ACME data_scientist';
    RAISE NOTICE '  henry@acme-ml.com    — ACME data_scientist';
    RAISE NOTICE '  iris@acme-ml.com     — ACME analyst';
    RAISE NOTICE '  jack@acme-ml.com     — ACME data_scientist';
    RAISE NOTICE '  kate@acme-ml.com     — ACME viewer';
    RAISE NOTICE '  dave@solo-dev.io     — Solo tier';
    RAISE NOTICE '  eve@free-mail.io     — Free tier';
    RAISE NOTICE '  frank@acme-ml.com    — Free tier + pending invite to ACME';
    RAISE NOTICE '';
    RAISE NOTICE 'To test the invite flow:';
    RAISE NOTICE '  1. Log in as frank@acme-ml.com';
    RAISE NOTICE '  2. Visit /company — pending invite card appears automatically';
    RAISE NOTICE '     (or open /company?invite=demo-invite-frank for auto-accept)';
    RAISE NOTICE '  3. Frank becomes a data_scientist member of ACME ML';
    RAISE NOTICE '────────────────────────────────────────────────────';
END $$;
