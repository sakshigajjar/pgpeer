const express = require('express');

const passport = require('../config/passport');
const authController = require('../controllers/auth.controller');
const { requireAuth } = require('../middleware/auth.middleware');

const router = express.Router();


// --- Email + password auth ---

// POST /api/auth/register → create account, set access + refresh cookies
router.post('/register', authController.register);

// POST /api/auth/login    → verify credentials, set access + refresh cookies
router.post('/login',    authController.login);

// POST /api/auth/refresh  → rotate refresh token, issue new access + refresh
router.post('/refresh',  authController.refresh);

// POST /api/auth/logout   → delete refresh row, clear both cookies
router.post('/logout',   authController.logout);


// --- Google OAuth ---

// GET /api/auth/google → 302 redirect to Google's auth URL.
// Passport handles building the URL with our client_id, scopes, callback, and state.
router.get(
  '/google',
  passport.authenticate('google', {
    scope: ['profile', 'email'],
    session: false,
  })
);

// GET /api/auth/google/callback → Google redirects here with ?code=...&state=...
// Passport middleware exchanges the code, fetches profile, runs our verify callback.
// On success: req.user is set → googleCallback issues OUR tokens + redirects to frontend.
// On failure: redirect to FRONTEND_URL with an error query param.
router.get(
  '/google/callback',
  passport.authenticate('google', {
    session: false,
    failureRedirect: `${process.env.FRONTEND_URL}?error=google_auth_failed`,
  }),
  authController.googleCallback
);


// --- Current user (protected) ---

// GET /api/auth/me → returns the logged-in user. Used by the frontend to bootstrap auth state.
router.get('/me', requireAuth, authController.me);


module.exports = router;
