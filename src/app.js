const express = require('express');
const cookieParser = require('cookie-parser');

const authRoutes = require('./routes/auth.routes');

const app = express();

// --- Global middleware (order matters: parsers first, then routes, then error handler) ---
app.use(express.json());        // parses JSON bodies into req.body
app.use(cookieParser());        // parses Cookie header into req.cookies

// --- Routes ---
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/auth', authRoutes);

// --- Centralised error handler (MUST be last; 4-argument signature) ---
// Express recognises (err, req, res, next) as an error handler specifically.
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

module.exports = app;
