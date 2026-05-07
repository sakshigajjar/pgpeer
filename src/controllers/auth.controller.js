const bcrypt = require('bcrypt');
const { query, transaction } = require('../config/db');
const {
  signAccessToken,
  generateRefreshToken,
  hashToken,
} = require('../utils/tokens');

const BCRYPT_COST = 12;
const COOKIE_SECURE = process.env.COOKIE_SECURE === 'true';

const ACCESS_COOKIE_MAX_AGE  = 15 * 60 * 1000;              // 15 minutes
const REFRESH_COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000;     // 7 days

// Precomputed at startup so login spends the same ~250ms whether the email
// exists or not. Prevents timing attacks that enumerate valid emails.
// hashSync blocks the event loop, but it's only run once at module load.
const TIMING_SAFE_FAKE_HASH = bcrypt.hashSync('___no_such_user___', BCRYPT_COST);

// Shared cookie attributes for both tokens.
function cookieOpts(maxAgeMs) {
  return {
    httpOnly: true,         // JS in the browser cannot read it (XSS protection)
    secure: COOKIE_SECURE,  // true → only sent over HTTPS (production)
    sameSite: 'lax',        // CSRF protection without breaking normal navigation
    maxAge: maxAgeMs,
  };
}

// Sets both auth cookies on the response. Used by register, login, and refresh.
function setAuthCookies(res, accessToken, refreshToken) {
  res.cookie('access_token',  accessToken,  cookieOpts(ACCESS_COOKIE_MAX_AGE));
  res.cookie('refresh_token', refreshToken, cookieOpts(REFRESH_COOKIE_MAX_AGE));
}

// Clears both auth cookies. Attributes (path, sameSite, secure) MUST match
// what was set, or the browser keeps the old cookies.
function clearAuthCookies(res) {
  const opts = { httpOnly: true, secure: COOKIE_SECURE, sameSite: 'lax' };
  res.clearCookie('access_token',  opts);
  res.clearCookie('refresh_token', opts);
}


async function register(req, res, next) {
  try {
    const { name, email, password } = req.body;

    // 1. Validate (manual — Decision #6, no validation library)
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({ error: 'Name is required' });
    }
    if (!email || typeof email !== 'string' || !/^\S+@\S+\.\S+$/.test(email)) {
      return res.status(400).json({ error: 'Valid email is required' });
    }
    if (!password || typeof password !== 'string' || password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }
    // bcrypt silently truncates beyond 72 bytes — fail loudly instead.
    if (password.length > 72) {
      return res.status(400).json({ error: 'Password must be at most 72 characters' });
    }

    const normalisedEmail = email.toLowerCase().trim();
    const normalisedName = name.trim();

    // 2. Check email uniqueness (race window exists; UNIQUE constraint catches it below)
    const existing = await query(
      'SELECT id FROM users WHERE email = $1',
      [normalisedEmail]
    );
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    // 3. Hash the password (cost 12 ≈ 250ms on modern hardware)
    const passwordHash = await bcrypt.hash(password, BCRYPT_COST);

    // 4. Insert user. RETURNING avoids a follow-up SELECT.
    let user;
    try {
      const insertResult = await query(
        `INSERT INTO users (name, email, password_hash)
         VALUES ($1, $2, $3)
         RETURNING id, name, email, created_at`,
        [normalisedName, normalisedEmail, passwordHash]
      );
      user = insertResult.rows[0];
    } catch (err) {
      // PG error code 23505 = unique_violation — handles the race condition above.
      if (err.code === '23505') {
        return res.status(409).json({ error: 'Email already registered' });
      }
      throw err;
    }

    // 5. Issue access token (JWT) + refresh token (opaque random)
    const accessToken = signAccessToken(user.id);
    const { rawToken, tokenHash, expiresAt } = generateRefreshToken();

    // 6. Persist refresh token HASH in DB (raw token only ever lives in the cookie)
    await query(
      `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
       VALUES ($1, $2, $3)`,
      [user.id, tokenHash, expiresAt]
    );

    // 7. Set both auth cookies
    setAuthCookies(res, accessToken, rawToken);

    // 8. Respond — tokens are in cookies, NOT in the body.
    return res.status(201).json({ user });
  } catch (err) {
    next(err);
  }
}


async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    // 1. Validate (lighter than register — only the two fields we need)
    if (!email || typeof email !== 'string') {
      return res.status(400).json({ error: 'Email is required' });
    }
    if (!password || typeof password !== 'string') {
      return res.status(400).json({ error: 'Password is required' });
    }

    const normalisedEmail = email.toLowerCase().trim();

    // 2. Look up user
    const result = await query(
      `SELECT id, name, email, password_hash, created_at
       FROM users WHERE email = $1`,
      [normalisedEmail]
    );
    const user = result.rows[0];

    // 3. Compare password — ALWAYS run bcrypt.compare even if the user doesn't
    // exist or has no password (Google-only). Otherwise response time leaks
    // whether the email is registered. Generic error message for the same reason.
    const hashToCompare = user?.password_hash || TIMING_SAFE_FAKE_HASH;
    const passwordOk = await bcrypt.compare(password, hashToCompare);

    if (!user || !user.password_hash || !passwordOk) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // 4. Issue access + refresh tokens (multi-session: do NOT delete existing tokens)
    const accessToken = signAccessToken(user.id);
    const { rawToken, tokenHash, expiresAt } = generateRefreshToken();

    await query(
      `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
       VALUES ($1, $2, $3)`,
      [user.id, tokenHash, expiresAt]
    );

    // 5. Set cookies
    setAuthCookies(res, accessToken, rawToken);

    // 6. Respond — same shape as /register so the frontend handles both uniformly.
    //    Strip password_hash from the row before returning.
    const { password_hash, ...safeUser } = user;
    return res.status(200).json({ user: safeUser });
  } catch (err) {
    next(err);
  }
}


async function refresh(req, res, next) {
  try {
    // 1. Read refresh token from cookie
    const rawToken = req.cookies.refresh_token;
    if (!rawToken) {
      return res.status(401).json({ error: 'No refresh token' });
    }

    // 2. Hash it for DB lookup (we never store the raw token)
    const incomingHash = hashToken(rawToken);

    // 3. Look up token + user in ONE query (JOIN avoids a second SELECT)
    const lookup = await query(
      `SELECT rt.id          AS token_id,
              rt.user_id     AS user_id,
              rt.expires_at  AS expires_at,
              u.name         AS name,
              u.email        AS email,
              u.created_at   AS created_at
       FROM refresh_tokens rt
       JOIN users u ON u.id = rt.user_id
       WHERE rt.token_hash = $1`,
      [incomingHash]
    );
    const row = lookup.rows[0];

    if (!row) {
      // Token not in DB. Could be: never issued, already rotated, or forged.
      return res.status(401).json({ error: 'Invalid refresh token' });
    }

    // 4. Check expiry
    if (new Date(row.expires_at) < new Date()) {
      // Clean up the expired row opportunistically.
      await query('DELETE FROM refresh_tokens WHERE id = $1', [row.token_id]);
      return res.status(401).json({ error: 'Refresh token expired' });
    }

    // 5. Generate new tokens BEFORE the transaction — pure CPU, no DB needed.
    const newAccess = signAccessToken(row.user_id);
    const newRefresh = generateRefreshToken();

    // 6. Atomic rotation: delete old refresh row + insert new one in a transaction.
    //    If we did DELETE then INSERT without a transaction and crashed in between,
    //    the user would be silently logged out.
    await transaction(async (client) => {
      await client.query(
        'DELETE FROM refresh_tokens WHERE id = $1',
        [row.token_id]
      );
      await client.query(
        `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
         VALUES ($1, $2, $3)`,
        [row.user_id, newRefresh.tokenHash, newRefresh.expiresAt]
      );
    });

    // 7. Set new cookies (overwrite the old ones in the browser)
    setAuthCookies(res, newAccess, newRefresh.rawToken);

    // 8. Respond with user (so frontend can rehydrate state without an extra call)
    return res.status(200).json({
      user: {
        id: row.user_id,
        name: row.name,
        email: row.email,
        created_at: row.created_at,
      },
    });
  } catch (err) {
    next(err);
  }
}


async function logout(req, res, next) {
  try {
    const rawToken = req.cookies.refresh_token;

    // Best-effort delete of the refresh row from DB. Idempotent — if the
    // cookie is missing or the row isn't there, we still clear cookies and
    // return 204. Logout is the user's intent; we honour it regardless.
    if (rawToken) {
      const incomingHash = hashToken(rawToken);
      await query(
        'DELETE FROM refresh_tokens WHERE token_hash = $1',
        [incomingHash]
      );
    }

    clearAuthCookies(res);

    // 204 No Content — success, no body needed.
    return res.status(204).end();
  } catch (err) {
    next(err);
  }
}


module.exports = { register, login, refresh, logout };
