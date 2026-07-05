const { query } = require('../config/db');
const { isValidState, isValidCity, CITIES } = require('../config/locations');

const MAX_LIMIT = 50;
const DEFAULT_SEARCH_LIMIT = 20;
const DEFAULT_RECENT_LIMIT = 10;

// Free-text field length caps. state and city are enum-validated against
// locations.js instead of length-checked.
const FIELD_MAX = {
  name:            200,
  address:         500,
  area:            100,
  google_maps_url: 2048,
};

// Google Maps URL hosts we accept: desktop (google.com/maps, maps.google.com),
// deprecated short (goo.gl/maps), and mobile share (maps.app.goo.gl).
const ALLOWED_MAPS_HOSTS = new Set([
  'www.google.com',
  'google.com',
  'maps.google.com',
  'goo.gl',
  'maps.app.goo.gl',
]);

// Validates google_maps_url shape only. No API call — we don't verify the URL
// resolves to a real place (would need Google Maps API + quota). Trade-off:
// catches fabricated URLs, doesn't catch a real Maps URL pointing to the wrong
// PG. That's a data-quality concern for community flagging, not validation.
function isValidMapsUrl(input) {
  if (typeof input !== 'string' || input.trim().length === 0) return false;
  let url;
  try {
    url = new URL(input.trim());
  } catch {
    return false;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return false;
  const host = url.hostname.toLowerCase();
  if (!ALLOWED_MAPS_HOSTS.has(host)) return false;
  // Shared-domain hosts also serve non-maps content; require /maps path prefix.
  if (host === 'www.google.com' || host === 'google.com' || host === 'goo.gl') {
    if (!url.pathname.startsWith('/maps')) return false;
  }
  return true;
}

// Valid reasons for flagging a PG listing. Differs from review flag reasons
// (see review.controller.js) — 'duplicate' is a PG-specific concern; 'abuse'
// doesn't apply to a listing.
const PG_FLAG_REASONS = ['spam', 'fake', 'duplicate', 'inappropriate', 'other'];


// POST /api/pgs — auth required (added_by comes from req.user, never the body)
//
// Validation order (cheap → expensive):
//   1. name / address / area — non-empty strings within length caps
//   2. state / city — canonical enum from locations.js
//   3. google_maps_url — hostname allow-list + /maps path check
//   4. soft duplicate check against pgs (409 with candidates unless caller
//      passes force_create: true after user acknowledges)
//   5. INSERT
async function createPg(req, res, next) {
  try {
    const { name, address, state, city, area, google_maps_url, force_create } = req.body;

    // --- Free-text field checks ---
    for (const field of ['name', 'address', 'area']) {
      const value = req.body[field];
      if (typeof value !== 'string' || value.trim().length === 0) {
        return res.status(400).json({ error: `${field} is required` });
      }
      if (value.trim().length > FIELD_MAX[field]) {
        return res.status(400).json({ error: `${field} must be at most ${FIELD_MAX[field]} characters` });
      }
    }

    // --- Enum checks (state, city from dropdown) ---
    if (!isValidState(state)) {
      return res.status(400).json({ error: 'state must be a valid Indian state or UT' });
    }
    if (!isValidCity(city, state)) {
      return res.status(400).json({ error: 'city must be a valid city in the selected state' });
    }

    // --- Google Maps URL check ---
    if (!isValidMapsUrl(google_maps_url)) {
      return res.status(400).json({
        error: 'google_maps_url must be a valid Google Maps URL (google.com/maps, maps.google.com, goo.gl/maps, or maps.app.goo.gl)',
      });
    }
    if (google_maps_url.trim().length > FIELD_MAX.google_maps_url) {
      return res.status(400).json({
        error: `google_maps_url must be at most ${FIELD_MAX.google_maps_url} characters`,
      });
    }

    const trimmedName    = name.trim();
    const trimmedAddress = address.trim();
    const trimmedArea    = area.trim();
    const trimmedUrl     = google_maps_url.trim();

    // --- Soft duplicate check ---
    // Matches within the same city where either (a) an existing name contains
    // the submitted name, or (b) the submitted name contains an existing name.
    // Both directions catch common cases: user retyping an existing PG with
    // extra words, or with fewer words. Area substring keeps this looser than
    // exact-area matching. force_create: true bypasses (used by frontend after
    // showing the user the candidates and getting confirmation).
    if (force_create !== true) {
      const dupResult = await query(
        `SELECT id, name, area
         FROM pgs
         WHERE city = $1
           AND area ILIKE $2
           AND (name ILIKE $3 OR $4 ILIKE ('%' || name || '%'))
         LIMIT 5`,
        [city, `%${trimmedArea}%`, `%${trimmedName}%`, trimmedName]
      );
      if (dupResult.rows.length > 0) {
        return res.status(409).json({
          error: 'possible_duplicate',
          message: 'A similar PG already exists in this area. Verify before creating.',
          candidates: dupResult.rows,
        });
      }
    }

    // --- INSERT ---
    const result = await query(
      `INSERT INTO pgs (name, address, state, city, area, google_maps_url, added_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, name, address, state, city, area, google_maps_url, added_by, created_at`,
      [trimmedName, trimmedAddress, state, city, trimmedArea, trimmedUrl, req.user.id]
    );

    return res.status(201).json({ pg: result.rows[0] });
  } catch (err) {
    next(err);
  }
}


// GET /api/pgs?state=&city=&area=&page=&limit= — public
//
// state and city use exact equality (canonical enum values from locations.js).
// area stays ILIKE fuzzy (still user-typed via combobox).
//
// On an invalid state or city filter value, returns an empty page instead of
// 400 — the search page can render "no results" without an error banner. The
// only 400 comes from calling with no filters at all.
async function searchPgs(req, res, next) {
  try {
    const state = req.query.state?.trim();
    const city  = req.query.city?.trim();
    const area  = req.query.area?.trim();

    if (!state && !city && !area) {
      return res.status(400).json({ error: 'At least one of state, city, or area is required' });
    }

    // Pagination — clamp to safe ranges so callers can't abuse it.
    const page  = Math.max(1, parseInt(req.query.page, 10)  || 1);
    const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(req.query.limit, 10) || DEFAULT_SEARCH_LIMIT));
    const offset = (page - 1) * limit;

    // Silent early-exit on unknown canonical filters. No PG can match a
    // state/city that doesn't exist, so short-circuit before hitting the DB.
    if (state && !isValidState(state)) {
      return res.json({ pgs: [], total: 0, page, limit });
    }
    if (city && !CITIES.some((c) => c.name === city)) {
      return res.json({ pgs: [], total: 0, page, limit });
    }

    // Build WHERE clause dynamically. Each filter pushes a placeholder so
    // we keep parameterised-query safety. state/city use = (canonical values);
    // area stays ILIKE fuzzy.
    const conditions = [];
    const params = [];
    if (state) {
      params.push(state);
      conditions.push(`state = $${params.length}`);
    }
    if (city) {
      params.push(city);
      conditions.push(`city = $${params.length}`);
    }
    if (area) {
      params.push(`%${area}%`);
      conditions.push(`area ILIKE $${params.length}`);
    }
    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    // Two queries: one for total count (for pagination UI), one for the page.
    const countResult = await query(
      `SELECT COUNT(*)::int AS total FROM pgs ${whereClause}`,
      params
    );
    const total = countResult.rows[0].total;

    params.push(limit, offset);
    const pgsResult = await query(
      `SELECT id, name, address, state, city, area, added_by, created_at
       FROM pgs
       ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    return res.json({ pgs: pgsResult.rows, total, page, limit });
  } catch (err) {
    next(err);
  }
}


// GET /api/pgs/recent?limit= — public homepage feed
async function recentPgs(req, res, next) {
  try {
    const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(req.query.limit, 10) || DEFAULT_RECENT_LIMIT));

    const result = await query(
      `SELECT id, name, address, state, city, area, added_by, created_at
       FROM pgs
       ORDER BY created_at DESC
       LIMIT $1`,
      [limit]
    );

    return res.json({ pgs: result.rows });
  } catch (err) {
    next(err);
  }
}


// GET /api/pgs/:id — public; JOINs users for added_by trust signal,
// plus a second query for embedded reviews with reviewer info.
async function getPgById(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id < 1) {
      return res.status(400).json({ error: 'Invalid PG id' });
    }

    // Query 1: PG + contributor info + flag count.
    // Flag count is a correlated subquery against idx_pg_flags_pg_id — trivial
    // at portfolio scale, avoids a second round-trip.
    const pgResult = await query(
      `SELECT pg.id, pg.name, pg.address, pg.state, pg.city, pg.area,
              pg.google_maps_url, pg.created_at,
              u.id         AS added_by_id,
              u.name       AS added_by_name,
              u.created_at AS added_by_created_at,
              (SELECT COUNT(*)::int FROM pg_flags WHERE pg_id = pg.id) AS flag_count
       FROM pgs pg
       JOIN users u ON u.id = pg.added_by
       WHERE pg.id = $1`,
      [id]
    );

    if (pgResult.rows.length === 0) {
      return res.status(404).json({ error: 'PG not found' });
    }

    const row = pgResult.rows[0];
    const pg = {
      id:              row.id,
      name:            row.name,
      address:         row.address,
      state:           row.state,
      city:            row.city,
      area:            row.area,
      google_maps_url: row.google_maps_url,
      created_at:      row.created_at,
      flag_count:      row.flag_count,
      added_by: {
        id:         row.added_by_id,
        name:       row.added_by_name,
        created_at: row.added_by_created_at,
      },
    };

    // Query 2: reviews for this PG + reviewer's public profile + flag count.
    // Sort: most-upvoted first, then most-recent — best content surfaces.
    // Flag count is a correlated subquery against idx_review_flags_review_id.
    const reviewsResult = await query(
      `SELECT r.id, r.rating_food, r.rating_cleanliness, r.rating_owner, r.rating_value,
              r.monthly_price, r.review_text, r.stay_duration, r.currently_living,
              r.upvotes, r.created_at,
              u.id         AS user_id,
              u.name       AS user_name,
              u.created_at AS user_created_at,
              (SELECT COUNT(*)::int FROM review_flags WHERE review_id = r.id) AS flag_count
       FROM reviews r
       JOIN users u ON u.id = r.user_id
       WHERE r.pg_id = $1
       ORDER BY r.upvotes DESC, r.created_at DESC`,
      [id]
    );

    const reviews = reviewsResult.rows.map((r) => ({
      id:                 r.id,
      rating_food:        r.rating_food,
      rating_cleanliness: r.rating_cleanliness,
      rating_owner:       r.rating_owner,
      rating_value:       r.rating_value,
      monthly_price:      r.monthly_price,
      review_text:        r.review_text,
      stay_duration:      r.stay_duration,
      currently_living:   r.currently_living,
      upvotes:            r.upvotes,
      flag_count:         r.flag_count,
      created_at:         r.created_at,
      user: {
        id:         r.user_id,
        name:       r.user_name,
        created_at: r.user_created_at,    // Locked rule #7: account age trust signal
      },
    }));

    // Query 3: photos for this PG.
    // Note: cloudinary_public_id is INTERNAL — not exposed to clients (only used
    // server-side for future deletion).
    const photosResult = await query(
      `SELECT id, photo_url, uploaded_by, created_at
       FROM pg_photos
       WHERE pg_id = $1
       ORDER BY created_at DESC`,
      [id]
    );
    const photos = photosResult.rows;

    return res.json({ pg, reviews, photos });
  } catch (err) {
    next(err);
  }
}


// GET /api/pgs/:id/summary — public; PURE READ from the cache.
//
// This endpoint never calls Gemini. The cache is written exclusively by
// createReview's background task (review.controller.js fires regenerateSummary
// without awaiting after each review insert).
//
// If ai_summary is null (PG never had a review, or the last regen failed and
// hasn't been retried yet), client gets { summary: null, tags: [] } and renders
// "Summary not available right now. Read reviews below."
//
// Why pure-read: keeps reads fast (~10ms), prevents double-Gemini-call races
// when multiple viewers hit the page concurrently, and isolates Gemini failures
// from the read path entirely. The only way to refresh the cache is to submit
// a review.
async function getPgSummary(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id < 1) {
      return res.status(400).json({ error: 'Invalid PG id' });
    }

    const pgResult = await query(
      `SELECT id, ai_summary FROM pgs WHERE id = $1`,
      [id]
    );
    if (pgResult.rows.length === 0) {
      return res.status(404).json({ error: 'PG not found' });
    }
    const pg = pgResult.rows[0];

    if (pg.ai_summary) {
      return res.json({ ...pg.ai_summary, cached: true });
    }

    return res.json({ summary: null, tags: [] });
  } catch (err) {
    next(err);
  }
}


// GET /api/pgs/:id/trend — public; monthly aggregates of ratings, price, review count
// for the last 12 months. Used by the frontend chart layer.
//
// One query does it all via date_trunc + AVG + COUNT + GROUP BY.
// Skips months with no reviews (frontend decides whether to show gaps).
async function getPgTrend(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id < 1) {
      return res.status(400).json({ error: 'Invalid PG id' });
    }

    // Verify PG exists — distinguishes "no reviews ever" from "PG doesn't exist".
    const pgCheck = await query('SELECT id FROM pgs WHERE id = $1', [id]);
    if (pgCheck.rows.length === 0) {
      return res.status(404).json({ error: 'PG not found' });
    }

    // Two correctness details in this query:
    //
    // (1) Bucket months in IST, not UTC.
    //     `created_at AT TIME ZONE 'Asia/Kolkata'` converts the TIMESTAMPTZ to a
    //     plain timestamp expressed in IST. date_trunc then rounds to IST month
    //     start. A review at 2am IST on the 1st correctly lands in that month.
    //
    // (2) Format month as text, not date.
    //     pg-node converts SQL DATE → JS Date interpreting it as LOCAL midnight,
    //     which then serializes via toISOString() as UTC — yielding "2026-04-30T18:30Z"
    //     instead of "2026-05-01" on a server in IST. Using to_char() returns a
    //     plain string the frontend can parse without timezone surprises.
    //
    // Number casts (::float8, ::int) make pg-node return JS numbers rather than
    // numeric-as-string. ROUND keeps decimals tidy in the JSON output.
    // CTE separates bucketing from aggregation: 'bucketed' attaches an IST
    // month_start to each review row; the outer SELECT averages within each bucket.
    const result = await query(
      `WITH bucketed AS (
         SELECT
           date_trunc('month', created_at AT TIME ZONE 'Asia/Kolkata') AS month_start,
           rating_food, rating_cleanliness, rating_owner, rating_value,
           monthly_price
         FROM reviews
         WHERE pg_id = $1
           AND created_at >= NOW() - INTERVAL '12 months'
       )
       SELECT
         to_char(month_start, 'YYYY-MM-DD') AS month,
         ROUND(AVG(rating_food)::numeric, 2)::float8        AS avg_rating_food,
         ROUND(AVG(rating_cleanliness)::numeric, 2)::float8 AS avg_rating_cleanliness,
         ROUND(AVG(rating_owner)::numeric, 2)::float8       AS avg_rating_owner,
         ROUND(AVG(rating_value)::numeric, 2)::float8       AS avg_rating_value,
         ROUND(AVG((rating_food + rating_cleanliness + rating_owner + rating_value) / 4.0)::numeric, 2)::float8 AS avg_overall,
         AVG(monthly_price)::int                            AS avg_monthly_price,
         COUNT(*)::int                                      AS review_count
       FROM bucketed
       GROUP BY month_start
       ORDER BY month_start ASC`,
      [id]
    );

    return res.json({ pg_id: id, trend: result.rows });
  } catch (err) {
    next(err);
  }
}


// GET /api/pgs/areas?city=X — public
//
// Returns distinct area names already used for PGs in the given city, sorted
// alphabetically. Powers the frontend area combobox — as the user types, they
// see canonical suggestions from existing PGs in that city, which cuts down
// on "Navrangpura" vs "Navrang Pura" style variance.
//
// If city is missing → 400. If city isn't in the canonical list → returns
// { areas: [] } silently — same UX as searchPgs, no error banner needed in
// the suggestion dropdown.
async function getPgAreas(req, res, next) {
  try {
    const city = req.query.city?.trim();
    if (!city) {
      return res.status(400).json({ error: 'city query parameter is required' });
    }

    // Unknown city → no suggestions. Short-circuit before hitting the DB.
    if (!CITIES.some((c) => c.name === city)) {
      return res.json({ areas: [] });
    }

    const result = await query(
      `SELECT DISTINCT area FROM pgs WHERE city = $1 ORDER BY area ASC`,
      [city]
    );

    return res.json({ areas: result.rows.map((r) => r.area) });
  } catch (err) {
    next(err);
  }
}


// POST /api/pgs/:id/flag — report a PG listing for community moderation.
// Body: { reason: 'spam' | 'fake' | 'duplicate' | 'inappropriate' | 'other' }
//
// Peer-only trust model: this endpoint just records the flag. There is no
// admin resolution — the aggregate flag_count exposed by GET /api/pgs/:id
// is what surfaces as a public credibility signal to other users.
async function flagPg(req, res, next) {
  try {
    const pgId = parseInt(req.params.id, 10);
    if (!Number.isInteger(pgId) || pgId < 1) {
      return res.status(400).json({ error: 'Invalid PG id' });
    }

    const { reason } = req.body;
    if (!PG_FLAG_REASONS.includes(reason)) {
      return res.status(400).json({
        error: `reason must be one of: ${PG_FLAG_REASONS.join(', ')}`,
      });
    }

    let flag;
    try {
      const result = await query(
        `INSERT INTO pg_flags (pg_id, flagged_by, reason)
         VALUES ($1, $2, $3)
         RETURNING id, pg_id, flagged_by, reason, created_at`,
        [pgId, req.user.id, reason]
      );
      flag = result.rows[0];
    } catch (err) {
      // 23503 = FK violation → pg_id doesn't reference an existing PG.
      if (err.code === '23503') {
        return res.status(404).json({ error: 'PG not found' });
      }
      // 23505 = UNIQUE violation → one_flag_per_user_per_pg constraint hit.
      if (err.code === '23505') {
        return res.status(409).json({ error: 'You have already flagged this PG' });
      }
      throw err;
    }

    return res.status(201).json({ flag });
  } catch (err) {
    next(err);
  }
}


module.exports = { createPg, searchPgs, recentPgs, getPgById, getPgSummary, getPgTrend, getPgAreas, flagPg };
