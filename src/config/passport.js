const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const { query } = require('./db');

// One-time strategy registration. Passport keeps a registry of strategies
// keyed by name ('google' here, default for this strategy).
passport.use(
  new GoogleStrategy(
    {
      clientID:     process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL:  process.env.GOOGLE_CALLBACK_URL,
      state: true,  // CSRF protection — uses express-session for storage
    },

    // The "verify callback" — passport calls this AFTER it has:
    //   1. Exchanged the OAuth code for an access token (server-to-server with Google)
    //   2. Fetched the user's profile from Google's userinfo endpoint
    //
    // Our job: find or create the user in OUR DB, then call done(null, user).
    // The user object we pass becomes req.user in the route handler.
    async (accessToken, refreshToken, profile, done) => {
      try {
        const googleId      = profile.id;
        const email         = (profile.emails?.[0]?.value || '').toLowerCase().trim();
        const emailVerified = profile.emails?.[0]?.verified === true;
        const name          = profile.displayName || email.split('@')[0] || 'User';

        if (!email) {
          return done(null, false, { message: 'Google did not return an email' });
        }

        // Path 1 — already linked: user has signed in with Google before.
        const byGoogleId = await query(
          'SELECT id, name, email, created_at FROM users WHERE google_id = $1',
          [googleId]
        );
        if (byGoogleId.rows.length > 0) {
          return done(null, byGoogleId.rows[0]);
        }

        // Path 2 — email exists from password registration, no google_id yet.
        const byEmail = await query(
          'SELECT id, name, email, created_at FROM users WHERE email = $1',
          [email]
        );
        if (byEmail.rows.length > 0) {
          if (!emailVerified) {
            // Refuse to link — Google didn't confirm email ownership.
            // Without this check, anyone could create a Google account claiming
            // someone else's email and hijack their PGPeer account.
            return done(null, false, {
              message: 'Email already registered. Use password login.',
            });
          }
          // Auto-link: attach this google_id to the existing row.
          const existing = byEmail.rows[0];
          await query(
            'UPDATE users SET google_id = $1 WHERE id = $2',
            [googleId, existing.id]
          );
          return done(null, existing);
        }

        // Path 3 — brand-new user. Insert with google_id, no password_hash.
        // (CHECK constraint allows this because google_id IS NOT NULL.)
        const inserted = await query(
          `INSERT INTO users (name, email, google_id)
           VALUES ($1, $2, $3)
           RETURNING id, name, email, created_at`,
          [name, email, googleId]
        );
        return done(null, inserted.rows[0]);
      } catch (err) {
        return done(err);
      }
    }
  )
);

module.exports = passport;
