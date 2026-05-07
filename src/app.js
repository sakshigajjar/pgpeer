const express = require('express');
const cookieParser = require('cookie-parser');
const session = require('express-session');

const passport = require('./config/passport');
const authRoutes = require('./routes/auth.routes');
const pgRoutes = require('./routes/pg.routes');

const app = express();

// --- Global middleware (order matters: parsers → session → passport → routes → errors) ---
app.use(express.json());        // parses JSON bodies into req.body
app.use(cookieParser());        // parses Cookie header into req.cookies

// Session middleware — used ONLY for OAuth state (CSRF protection during the
// Google login dance). Not used for user identity; that's JWT/refresh tokens.
// Memory store is fine on free-tier Render (single instance) and the data is
// ephemeral (cookie expires in 10 min).
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.COOKIE_SECURE === 'true',
    sameSite: 'lax',                 // must allow cross-site nav from Google
    maxAge: 10 * 60 * 1000,          // 10 minutes — long enough for the OAuth dance
  },
}));

app.use(passport.initialize());

// --- Routes ---
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/auth', authRoutes);
app.use('/api/pgs',  pgRoutes);

// --- Centralised error handler (MUST be last; 4-argument signature) ---
// Express recognises (err, req, res, next) as an error handler specifically.
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

module.exports = app;
