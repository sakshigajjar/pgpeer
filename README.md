# PGPeer

Peer-only PG (Paying Guest) review platform for India.

Portfolio project — Node.js + Express + PostgreSQL (Supabase) backend, React frontend.

## Setup

1. Install dependencies: `npm install`
2. Copy `.env.example` to `.env` and fill in `DATABASE_URL` from Supabase dashboard
3. Run dev server: `npm run dev`
4. Verify: open http://localhost:5000/health

## Structure

- `server.js` — entry point, starts HTTP server
- `src/app.js` — Express app config (no `.listen`, so it's testable)
- `src/config/db.js` — PostgreSQL connection pool + parameterised query helper
- `src/routes/` — URL → controller mapping (added per phase)
- `src/controllers/` — request handlers (added per phase)
- `src/middleware/` — auth, error handling (added per phase)
- `src/db/schema.sql` — database schema (canonical DDL)

## Database schema

Eight tables, applied manually via the Supabase SQL editor from `src/db/schema.sql`.
Every business rule that can be encoded as a DB constraint is — the DB is the last
line of defence against buggy application code.

### `users`

Registered users. Supports password-only, Google-only, and hybrid accounts.

- `id` BIGSERIAL PK
- `name` TEXT NOT NULL
- `email` TEXT NOT NULL UNIQUE (stored lowercased)
- `password_hash` TEXT — nullable for Google-only users
- `google_id` TEXT UNIQUE — nullable for password-only users
- `created_at` TIMESTAMPTZ — powers the "account age" trust signal
- **CHECK** `password_hash IS NOT NULL OR google_id IS NOT NULL` — every user has at least one login method

### `refresh_tokens`

Stateful side of the auth pair. Access tokens are stateless JWTs; refresh tokens
live in the DB (hashed) so logout and rotation are real.

- `id` BIGSERIAL PK
- `user_id` BIGINT FK → users(id) ON DELETE CASCADE
- `token_hash` TEXT NOT NULL UNIQUE — SHA-256 hex of the raw token
- `expires_at` TIMESTAMPTZ NOT NULL (7 days from issue)
- `created_at` TIMESTAMPTZ NOT NULL DEFAULT NOW()
- Index on `user_id` for future "logout all sessions" flow

### `pgs`

Paying Guest accommodations. Location is flat text (state/city/area) rather than
a normalised locations table — simpler queries, matches how users search.
`state` and `city` are enum-validated at the app layer against `src/config/locations.js`;
`area` is user-typed with combobox suggestions from existing values.

- `id` BIGSERIAL PK
- `name`, `address` TEXT NOT NULL
- `state`, `city`, `area` TEXT NOT NULL — indexed for filter queries
- `google_maps_url` TEXT NOT NULL — required trust signal; format-validated in the controller (google.com/maps, maps.google.com, goo.gl/maps, or maps.app.goo.gl)
- `added_by` BIGINT FK → users(id) ON DELETE RESTRICT — can't drop a contributor
- `created_at` TIMESTAMPTZ NOT NULL DEFAULT NOW() — indexed DESC for recent-feed
- `ai_summary` JSONB — Gemini `{summary, tags}` cache
- `summary_generated_at` TIMESTAMPTZ — TTL check; NULL means "regenerate next call"

### `reviews`

A user's review of a specific PG. Junction table between users and pgs with
review payload on the association.

- `id` BIGSERIAL PK
- `pg_id` BIGINT FK → pgs(id) ON DELETE CASCADE — indexed
- `user_id` BIGINT FK → users(id) ON DELETE CASCADE
- `rating_food`, `rating_cleanliness`, `rating_owner`, `rating_value` SMALLINT — each CHECK BETWEEN 1 AND 5
- `monthly_price` INTEGER — CHECK > 0
- `review_text` TEXT NOT NULL — 30-word minimum enforced in app
- `stay_duration` INTEGER — CHECK > 0, in months
- `currently_living` BOOLEAN NOT NULL
- `upvotes` INTEGER NOT NULL DEFAULT 0 — denormalised counter of review_upvotes
- `created_at` TIMESTAMPTZ NOT NULL DEFAULT NOW() — indexed DESC
- **UNIQUE** `(pg_id, user_id)` — one review per user per PG, race-condition safe

### `review_upvotes`

Source of truth for who upvoted what. Toggling off deletes the row.

- `id` BIGSERIAL PK
- `review_id` BIGINT FK → reviews(id) ON DELETE CASCADE — indexed
- `user_id` BIGINT FK → users(id) ON DELETE CASCADE
- `created_at` TIMESTAMPTZ NOT NULL DEFAULT NOW()
- **UNIQUE** `(review_id, user_id)` — one upvote per user per review

### `review_flags`

Community moderation signal on reviews. Aggregate count surfaces to readers;
no admin resolves individual flags (peer-only trust model).

- `id` BIGSERIAL PK
- `review_id` BIGINT FK → reviews(id) ON DELETE CASCADE — indexed
- `flagged_by` BIGINT FK → users(id) ON DELETE CASCADE
- `reason` TEXT NOT NULL — CHECK IN (`spam`, `fake`, `abuse`, `inappropriate`, `other`)
- `created_at` TIMESTAMPTZ NOT NULL DEFAULT NOW()
- **UNIQUE** `(review_id, flagged_by)` — no flag spamming the same review

### `pg_flags`

Community moderation signal on PG listings. Mirrors `review_flags` — same shape,
same peer-only trust model (no admin resolution; aggregate `flag_count` surfaces
as a public credibility signal via `GET /api/pgs/:id`).

- `id` BIGSERIAL PK
- `pg_id` BIGINT FK → pgs(id) ON DELETE CASCADE — indexed
- `flagged_by` BIGINT FK → users(id) ON DELETE CASCADE
- `reason` TEXT NOT NULL — CHECK IN (`spam`, `fake`, `duplicate`, `inappropriate`, `other`)
- `created_at` TIMESTAMPTZ NOT NULL DEFAULT NOW()
- **UNIQUE** `(pg_id, flagged_by)` — one flag per user per PG

Differs from `review_flags` in the reason enum: has `duplicate` (a listing-specific
concern), doesn't have `abuse` (which applies to authored content).

### `pg_photos`

Cloudinary-hosted photos. Only URLs and public IDs live in the DB — never binaries.

- `id` BIGSERIAL PK
- `pg_id` BIGINT FK → pgs(id) ON DELETE CASCADE — indexed
- `photo_url` TEXT NOT NULL — Cloudinary `secure_url`
- `cloudinary_public_id` TEXT NOT NULL — internal only, needed to delete from Cloudinary
- `uploaded_by` BIGINT FK → users(id) ON DELETE RESTRICT
- `created_at` TIMESTAMPTZ NOT NULL DEFAULT NOW()

### Relationships at a glance

```
users (1) ─< pgs           via pgs.added_by         RESTRICT
users (1) ─< reviews       via reviews.user_id      CASCADE
users (1) ─< refresh_tokens                         CASCADE
users (1) ─< review_upvotes                         CASCADE
users (1) ─< review_flags                           CASCADE
users (1) ─< pg_flags      via pg_flags.flagged_by  CASCADE
users (1) ─< pg_photos     via pg_photos.uploaded_by RESTRICT

pgs   (1) ─< reviews                                CASCADE
pgs   (1) ─< pg_flags                               CASCADE
pgs   (1) ─< pg_photos                              CASCADE

reviews (1) ─< review_upvotes                       CASCADE
reviews (1) ─< review_flags                         CASCADE
```

## API endpoints

All routes are mounted under `/api`. `Auth` column: **Public** = no auth,
**Cookie** = reads refresh_token cookie only, **Required** = access_token
required (auto-refreshes via /auth/refresh on TOKEN_EXPIRED).

### Auth — `src/routes/auth.routes.js`

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/api/auth/register` | Public | Create account; set access + refresh cookies |
| POST | `/api/auth/login` | Public | Verify credentials; set access + refresh cookies |
| POST | `/api/auth/refresh` | Cookie | Rotate refresh token; issue new access + refresh |
| POST | `/api/auth/logout` | Cookie | Delete refresh row; clear both cookies |
| GET | `/api/auth/google` | Public | Redirect to Google OAuth consent |
| GET | `/api/auth/google/callback` | Public | Google returns here; issue our tokens; redirect to frontend |
| GET | `/api/auth/me` | Required | Return current user (frontend bootstrap) |

### PGs — `src/routes/pg.routes.js`

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/api/pgs` | Required | Create a PG; validates enum state/city, Maps URL format, soft-duplicate check → 409 with candidates (bypass via `force_create: true`) |
| POST | `/api/pgs/:id/photos` | Required | Upload photo to Cloudinary (multipart/form-data) |
| POST | `/api/pgs/:id/flag` | Required | Flag a PG listing with a reason (`spam`, `fake`, `duplicate`, `inappropriate`, `other`) |
| GET | `/api/pgs?state=&city=&area=&page=&limit=` | Public | Search PGs; state/city exact-match on canonical enum, area ILIKE fuzzy |
| GET | `/api/pgs/recent?limit=` | Public | Homepage feed — most recent PGs |
| GET | `/api/pgs/areas?city=X` | Public | Distinct existing areas in a city — powers the area combobox suggestions |
| GET | `/api/pgs/:id` | Public | PG detail + reviews + photos; includes `flag_count` on PG and each review |
| GET | `/api/pgs/:id/summary` | Public | Gemini summary + tags (cached in `pgs.ai_summary`) |
| GET | `/api/pgs/:id/trend` | Public | Monthly rating + price trend for last 12 months |

Route ordering matters: `/recent`, `/areas`, `/:id/summary`, `/:id/trend` are
declared before `/:id` so they don't match the parameterised route with
`id="recent"` etc.

### Reviews — `src/routes/review.routes.js`

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/api/reviews` | Required | Submit a review (enforces one-review-per-user at DB) |
| POST | `/api/reviews/:id/upvote` | Required | Toggle upvote on/off |
| POST | `/api/reviews/:id/flag` | Required | Flag review with reason |

### Misc

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/health` | Public | Liveness check (uptime monitoring) |
