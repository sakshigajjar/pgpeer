const { query } = require('../config/db');

const MAX_LIMIT = 50;
const DEFAULT_SEARCH_LIMIT = 20;
const DEFAULT_RECENT_LIMIT = 10;

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


// GET /api/pgs/:id — public; JOINs users for added_by trust signal
async function getPgById(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id < 1) {
      return res.status(400).json({ error: 'Invalid PG id' });
    }

    const result = await query(
      `SELECT pg.id, pg.name, pg.address, pg.state, pg.city, pg.area, pg.created_at,
              u.id         AS added_by_id,
              u.name       AS added_by_name,
              u.created_at AS added_by_created_at
       FROM pgs pg
       JOIN users u ON u.id = pg.added_by
       WHERE pg.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'PG not found' });
    }

    // Reshape flat JOIN result into nested object — added_by is the contributor's
    // public profile, exposed for trust (see business rule #7: account age signals).
    const row = result.rows[0];
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

    return res.json({ pg });
  } catch (err) {
    next(err);
  }
}


module.exports = { createPg, searchPgs, recentPgs, getPgById };
