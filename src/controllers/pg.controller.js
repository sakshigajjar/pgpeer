const { query } = require('../config/db');
const { summaryModel, buildSummaryPrompt } = require('../config/gemini');

const MAX_LIMIT = 50;
const DEFAULT_SEARCH_LIMIT = 20;
const DEFAULT_RECENT_LIMIT = 10;
const SUMMARY_CACHE_TTL_MS = 24 * 60 * 60 * 1000;     // 24 hours

// Validation rules from Phase 4 design discussion.
const FIELD_MAX = {
  name:    200,
  address: 500,
  state:   100,
  city:    100,
  area:    100,
};


// POST /api/pgs — auth required (added_by comes from req.user, never the body)
async function createPg(req, res, next) {
  try {
    const { name, address, state, city, area } = req.body;

    // Validate each field: must be a non-empty string after trim, within length cap.
    for (const field of ['name', 'address', 'state', 'city', 'area']) {
      const value = req.body[field];
      if (typeof value !== 'string' || value.trim().length === 0) {
        return res.status(400).json({ error: `${field} is required` });
      }
      if (value.trim().length > FIELD_MAX[field]) {
        return res.status(400).json({ error: `${field} must be at most ${FIELD_MAX[field]} characters` });
      }
    }

    const result = await query(
      `INSERT INTO pgs (name, address, state, city, area, added_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, name, address, state, city, area, added_by, created_at`,
      [name.trim(), address.trim(), state.trim(), city.trim(), area.trim(), req.user.id]
    );

    return res.status(201).json({ pg: result.rows[0] });
  } catch (err) {
    next(err);
  }
}


// GET /api/pgs?state=&city=&area=&page=&limit= — public
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

    // Build WHERE clause dynamically. Each filter pushes a placeholder so
    // we keep parameterised-query safety. Never interpolate user input.
    const conditions = [];
    const params = [];
    if (state) {
      params.push(`%${state}%`);
      conditions.push(`state ILIKE $${params.length}`);
    }
    if (city) {
      params.push(`%${city}%`);
      conditions.push(`city ILIKE $${params.length}`);
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

    // Query 1: PG + contributor info
    const pgResult = await query(
      `SELECT pg.id, pg.name, pg.address, pg.state, pg.city, pg.area, pg.created_at,
              u.id         AS added_by_id,
              u.name       AS added_by_name,
              u.created_at AS added_by_created_at
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
      id:         row.id,
      name:       row.name,
      address:    row.address,
      state:      row.state,
      city:       row.city,
      area:       row.area,
      created_at: row.created_at,
      added_by: {
        id:         row.added_by_id,
        name:       row.added_by_name,
        created_at: row.added_by_created_at,
      },
    };

    // Query 2: reviews for this PG + reviewer's public profile.
    // Sort: most-upvoted first, then most-recent — best content surfaces.
    const reviewsResult = await query(
      `SELECT r.id, r.rating_food, r.rating_cleanliness, r.rating_owner, r.rating_value,
              r.monthly_price, r.review_text, r.stay_duration, r.currently_living,
              r.upvotes, r.created_at,
              u.id         AS user_id,
              u.name       AS user_name,
              u.created_at AS user_created_at
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


// GET /api/pgs/:id/summary — public; AI-generated summary + tags from Gemini.
//
// Caching strategy:
//   1. If cache fresh (< 24h old) → return cache, no Gemini call
//   2. Otherwise → fetch reviews, call Gemini, save result, return
//   3. On Gemini error / parse failure → return stale cache if exists, else null
//
// Invalidation happens in createReview (sets summary_generated_at = NULL).
async function getPgSummary(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id < 1) {
      return res.status(400).json({ error: 'Invalid PG id' });
    }

    // 1. Fetch PG with cache fields
    const pgResult = await query(
      `SELECT id, ai_summary, summary_generated_at FROM pgs WHERE id = $1`,
      [id]
    );
    if (pgResult.rows.length === 0) {
      return res.status(404).json({ error: 'PG not found' });
    }
    const pg = pgResult.rows[0];

    // 2. Cache hit? (fresh = exists AND less than TTL old)
    if (pg.ai_summary && pg.summary_generated_at) {
      const ageMs = Date.now() - new Date(pg.summary_generated_at).getTime();
      if (ageMs < SUMMARY_CACHE_TTL_MS) {
        return res.json({ ...pg.ai_summary, cached: true });
      }
    }

    // 3. Fetch reviews to feed Gemini
    const reviewsResult = await query(
      `SELECT rating_food, rating_cleanliness, rating_owner, rating_value,
              monthly_price, review_text, stay_duration, currently_living
       FROM reviews
       WHERE pg_id = $1
       ORDER BY created_at DESC`,
      [id]
    );
    const reviews = reviewsResult.rows;

    // 4. No reviews → no summary possible
    if (reviews.length === 0) {
      return res.json({ summary: null, tags: [] });
    }

    // 5-9. Call Gemini, with stale fallback on any error
    try {
      const prompt = buildSummaryPrompt(reviews);
      const result = await summaryModel.generateContent(prompt);
      const raw = result.response.text();
      const parsed = JSON.parse(raw);

      // Sanity-check shape — defends against Gemini occasionally returning unexpected JSON.
      if (typeof parsed.summary !== 'string' || !Array.isArray(parsed.tags)) {
        throw new Error('Gemini response missing expected fields');
      }

      // Save to DB. JSONB column accepts a stringified JSON literal.
      await query(
        `UPDATE pgs
         SET ai_summary = $1, summary_generated_at = NOW()
         WHERE id = $2`,
        [JSON.stringify(parsed), id]
      );

      return res.json({ ...parsed, cached: false });
    } catch (err) {
      // Log for debugging — does NOT crash the request.
      console.error('Gemini error:', err.message);

      // Stale cache fallback — better than nothing.
      if (pg.ai_summary) {
        return res.json({ ...pg.ai_summary, stale: true });
      }
      return res.json({ summary: null, tags: [] });
    }
  } catch (err) {
    next(err);
  }
}


module.exports = { createPg, searchPgs, recentPgs, getPgById, getPgSummary };
