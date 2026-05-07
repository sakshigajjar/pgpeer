const { Pool } = require('pg');

// Pool reuses a small set of connections — cheaper than opening one per query.
// Supabase requires SSL; rejectUnauthorized:false is fine for free-tier self-signed certs.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// Always call this with (text, params) — never interpolate user input into `text`.
const query = (text, params) => pool.query(text, params);

// Run multiple queries atomically inside a single connection.
// Inside the callback, use `client.query(...)` — NOT the exported `query()` —
// so every statement runs on the same connection that holds the BEGIN/COMMIT.
//
// Usage:
//   await transaction(async (client) => {
//     await client.query('DELETE FROM ...');
//     await client.query('INSERT INTO ...');
//   });
async function transaction(callback) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { query, pool, transaction };
