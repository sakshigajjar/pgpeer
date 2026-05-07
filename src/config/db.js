const { Pool } = require('pg');

// Pool reuses a small set of connections — cheaper than opening one per query.
// Supabase requires SSL; rejectUnauthorized:false is fine for free-tier self-signed certs.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// Always call this with (text, params) — never interpolate user input into `text`.
const query = (text, params) => pool.query(text, params);

module.exports = { query, pool };
