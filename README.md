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
- `src/db/schema.sql` — database schema
