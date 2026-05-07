const { verifyAccessToken } = require('../utils/tokens');

// Express middleware that protects routes by requiring a valid access token.
// Usage in a router:
//   router.post('/reviews', requireAuth, reviewController.create);
//
// On success: attaches req.user = { id } and calls next().
// On failure: responds 401 with a code so the frontend knows whether to attempt /refresh.
function requireAuth(req, res, next) {
  const token = req.cookies?.access_token;
  if (!token) {
    return res.status(401).json({ error: 'Authentication required', code: 'NO_TOKEN' });
  }

  try {
    const payload = verifyAccessToken(token);
    // Attach the bare minimum to req. Don't fetch the full user — that's an extra DB
    // call on every authenticated request. Controllers that need user details can
    // SELECT by req.user.id when they actually need them.
    req.user = { id: payload.sub };
    return next();
  } catch (err) {
    // jsonwebtoken throws TokenExpiredError specifically when exp has passed.
    // We surface this so the frontend knows to call /refresh instead of forcing re-login.
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Access token expired', code: 'TOKEN_EXPIRED' });
    }
    return res.status(401).json({ error: 'Invalid authentication', code: 'INVALID_TOKEN' });
  }
}

module.exports = { requireAuth };
