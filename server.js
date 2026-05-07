// Load .env into process.env BEFORE importing any module that reads env vars.
require('dotenv').config();

const app = require('./src/app');

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`PGPeer server running on http://localhost:${PORT}`);
});
