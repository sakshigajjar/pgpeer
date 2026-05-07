-- PGPeer database schema
-- Apply this entire file in the Supabase SQL editor when new tables are added.
-- All statements use IF NOT EXISTS so re-running is safe.
--
-- Tables added per phase:
--   Phase 2: users, refresh_tokens
--   Phase 4: pgs
--   Phase 5: reviews
--   Phase 6: review_upvotes, review_flags
--   Phase 7: pg_photos


-- =============================================================
-- Phase 2: Authentication
-- =============================================================

CREATE TABLE IF NOT EXISTS users (
    id              BIGSERIAL    PRIMARY KEY,
    name            TEXT         NOT NULL,
    email           TEXT         NOT NULL UNIQUE,   -- stored lowercase (normalised in app)
    password_hash   TEXT,                            -- NULL for Google-only users
    google_id       TEXT         UNIQUE,             -- NULL for password-only users
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

    -- Every user must have at least one auth method (password OR google).
    CONSTRAINT users_identity_check
        CHECK (password_hash IS NOT NULL OR google_id IS NOT NULL)
);


CREATE TABLE IF NOT EXISTS refresh_tokens (
    id           BIGSERIAL    PRIMARY KEY,
    user_id      BIGINT       NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash   TEXT         NOT NULL UNIQUE,       -- SHA-256 hex of the raw token
    expires_at   TIMESTAMPTZ  NOT NULL,
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Speeds up "delete all tokens for user X" (used by future log-out-all-sessions).
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id
    ON refresh_tokens(user_id);


-- =============================================================
-- Phase 4: PGs (accommodations)
-- =============================================================

CREATE TABLE IF NOT EXISTS pgs (
    id          BIGSERIAL    PRIMARY KEY,
    name        TEXT         NOT NULL,
    address     TEXT         NOT NULL,
    state       TEXT         NOT NULL,                              -- e.g., 'Karnataka'; free text, ILIKE-searched
    city        TEXT         NOT NULL,                              -- stored as-typed; searched case-insensitively
    area        TEXT         NOT NULL,                              -- stored as-typed
    added_by    BIGINT       NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Speeds up state/city/area filtering and the recent-feed sort.
CREATE INDEX IF NOT EXISTS idx_pgs_state      ON pgs (state);
CREATE INDEX IF NOT EXISTS idx_pgs_city       ON pgs (city);
CREATE INDEX IF NOT EXISTS idx_pgs_area       ON pgs (area);
CREATE INDEX IF NOT EXISTS idx_pgs_created_at ON pgs (created_at DESC);
