const express = require('express');

const app = express();

// Parse JSON request bodies — replaces the old body-parser package.
app.use(express.json());

// Liveness check — proves the HTTP server is up without touching the DB.
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

module.exports = app;
