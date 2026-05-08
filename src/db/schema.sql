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


-- =============================================================
-- Phase 5: Reviews
-- =============================================================

CREATE TABLE IF NOT EXISTS reviews (
    id                  BIGSERIAL    PRIMARY KEY,
    pg_id               BIGINT       NOT NULL REFERENCES pgs(id)   ON DELETE CASCADE,
    user_id             BIGINT       NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    rating_food         SMALLINT     NOT NULL CHECK (rating_food         BETWEEN 1 AND 5),
    rating_cleanliness  SMALLINT     NOT NULL CHECK (rating_cleanliness  BETWEEN 1 AND 5),
    rating_owner        SMALLINT     NOT NULL CHECK (rating_owner        BETWEEN 1 AND 5),
    rating_value        SMALLINT     NOT NULL CHECK (rating_value        BETWEEN 1 AND 5),
    monthly_price       INTEGER      NOT NULL CHECK (monthly_price > 0),
    review_text         TEXT         NOT NULL,                              -- 30-word minimum enforced in app
    stay_duration       INTEGER      NOT NULL CHECK (stay_duration > 0),    -- months
    currently_living    BOOLEAN      NOT NULL,
    upvotes             INTEGER      NOT NULL DEFAULT 0,                    -- populated in Phase 6
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

    -- Locked rule #1: one review per user per PG.
    CONSTRAINT one_review_per_user_per_pg UNIQUE (pg_id, user_id)
);

-- Speeds up "all reviews of this PG" lookups (used by GET /api/pgs/:id).
CREATE INDEX IF NOT EXISTS idx_reviews_pg_id      ON reviews(pg_id);
CREATE INDEX IF NOT EXISTS idx_reviews_created_at ON reviews(created_at DESC);


-- =============================================================
-- Phase 6: Trust features (upvotes + flags)
-- =============================================================

CREATE TABLE IF NOT EXISTS review_upvotes (
    id          BIGSERIAL    PRIMARY KEY,
    review_id   BIGINT       NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
    user_id     BIGINT       NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

    -- One upvote per (user, review). Toggling off DELETEs the row.
    CONSTRAINT one_upvote_per_user_per_review UNIQUE (review_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_review_upvotes_review_id ON review_upvotes(review_id);


CREATE TABLE IF NOT EXISTS review_flags (
    id          BIGSERIAL    PRIMARY KEY,
    review_id   BIGINT       NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
    flagged_by  BIGINT       NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
    reason      TEXT         NOT NULL CHECK (reason IN ('spam', 'fake', 'abuse', 'inappropriate', 'other')),
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

    -- One flag per (user, review). User can't spam-flag the same review.
    CONSTRAINT one_flag_per_user_per_review UNIQUE (review_id, flagged_by)
);

CREATE INDEX IF NOT EXISTS idx_review_flags_review_id ON review_flags(review_id);
