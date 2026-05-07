const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;
const ACCESS_EXPIRY = process.env.ACCESS_TOKEN_EXPIRY || '15m';
const REFRESH_DAYS = parseInt(process.env.REFRESH_TOKEN_EXPIRY_DAYS || '7', 10);

// Fail fast at startup — better than failing on the first auth request in production.
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET is not set in .env');
}

// Sign a short-lived access token. 'sub' is the standard JWT claim for "subject".
function signAccessToken(userId) {
  return jwt.sign({ sub: userId }, JWT_SECRET, { expiresIn: ACCESS_EXPIRY });
}

// Verify an access token. Returns the decoded payload or throws.
function verifyAccessToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

// Generate a new opaque refresh token. Returns:
//   rawToken   — sent to client in the cookie
//   tokenHash  — stored in DB (so a leaked DB dump cannot replay tokens)
//   expiresAt  — Date for DB expires_at column
function generateRefreshToken() {
  const rawToken = crypto.randomBytes(32).toString('base64url');
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + REFRESH_DAYS * 24 * 60 * 60 * 1000);
  return { rawToken, tokenHash, expiresAt };
}

// Fast SHA-256 hash. Refresh tokens already have 256 bits of entropy from randomBytes(32),
// so we don't need bcrypt's slowness — that's only useful for low-entropy passwords.
function hashToken(rawToken) {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

module.exports = {
  signAccessToken,
  verifyAccessToken,
  generateRefreshToken,
  hashToken,
};
