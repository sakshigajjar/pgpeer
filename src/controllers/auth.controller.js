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

// Sets both auth cookies on the response. Used by register, login, refresh, googleCallback.
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

// Issue access + refresh tokens for a given user, persist refresh hash, set cookies.
// Used by login, refresh, and googleCallback — they all do the same thing post-auth.
async function issueAuthCookies(res, userId) {
  const accessToken = signAccessToken(userId);
  const { rawToken, tokenHash, expiresAt } = generateRefreshToken();

  await query(
    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
     VALUES ($1, $2, $3)`,
    [userId, tokenHash, expiresAt]
  );

  setAuthCookies(res, accessToken, rawToken);
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
      if (err.code === '23505') {
        return res.status(409).json({ error: 'Email already registered' });
      }
      throw err;
    }

    // 5. Issue tokens + set cookies
    await issueAuthCookies(res, user.id);

    return res.status(201).json({ user });
  } catch (err) {
    next(err);
  }
}


async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    if (!email || typeof email !== 'string') {
      return res.status(400).json({ error: 'Email is required' });
    }
    if (!password || typeof password !== 'string') {
      return res.status(400).json({ error: 'Password is required' });
    }

    const normalisedEmail = email.toLowerCase().trim();

    const result = await query(
      `SELECT id, name, email, password_hash, created_at
       FROM users WHERE email = $1`,
      [normalisedEmail]
    );
    const user = result.rows[0];

    // ALWAYS run bcrypt.compare even if no user / no password — timing-safe.
    const hashToCompare = user?.password_hash || TIMING_SAFE_FAKE_HASH;
    const passwordOk = await bcrypt.compare(password, hashToCompare);

    if (!user || !user.password_hash || !passwordOk) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    await issueAuthCookies(res, user.id);

    const { password_hash, ...safeUser } = user;
    return res.status(200).json({ user: safeUser });
  } catch (err) {
    next(err);
  }
}


async function refresh(req, res, next) {
  try {
    const rawToken = req.cookies.refresh_token;
    if (!rawToken) {
      return res.status(401).json({ error: 'No refresh token' });
    }

    const incomingHash = hashToken(rawToken);

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
      return res.status(401).json({ error: 'Invalid refresh token' });
    }
    if (new Date(row.expires_at) < new Date()) {
      await query('DELETE FROM refresh_tokens WHERE id = $1', [row.token_id]);
      return res.status(401).json({ error: 'Refresh token expired' });
    }

    const newAccess = signAccessToken(row.user_id);
    const newRefresh = generateRefreshToken();

    // Atomic rotation: delete old refresh row + insert new one.
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

    setAuthCookies(res, newAccess, newRefresh.rawToken);

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

    if (rawToken) {
      const incomingHash = hashToken(rawToken);
      await query(
        'DELETE FROM refresh_tokens WHERE token_hash = $1',
        [incomingHash]
      );
    }

    clearAuthCookies(res);
    return res.status(204).end();
  } catch (err) {
    next(err);
  }
}


// Called AFTER passport.authenticate('google') middleware has run successfully.
// At this point req.user is the user row our verify callback returned.
async function googleCallback(req, res, next) {
  try {
    if (!req.user) {
      // Defensive — passport's failureRedirect should have caught this earlier.
      return res.redirect(`${process.env.FRONTEND_URL}?error=google_auth_failed`);
    }

    await issueAuthCookies(res, req.user.id);

    // 302 to the frontend. Cookies are now set on the browser.
    return res.redirect(process.env.FRONTEND_URL);
  } catch (err) {
    next(err);
  }
}


// GET /api/auth/me — protected. Returns the current user.
// requireAuth middleware has already verified the access token and set req.user.id.
async function me(req, res, next) {
  try {
    const result = await query(
      'SELECT id, name, email, created_at FROM users WHERE id = $1',
      [req.user.id]
    );
    const user = result.rows[0];
    if (!user) {
      // Token valid but the user row was deleted — rare edge case.
      return res.status(404).json({ error: 'User not found' });
    }
    return res.json({ user });
  } catch (err) {
    next(err);
  }
}


module.exports = {
  register,
  login,
  refresh,
  logout,
  googleCallback,
  me,
};
