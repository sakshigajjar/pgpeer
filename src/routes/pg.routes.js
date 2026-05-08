const express = require('express');

const pgController = require('../controllers/pg.controller');
const { uploadPhoto, photoUploadMiddleware } = require('../controllers/pgPhoto.controller');
const { requireAuth } = require('../middleware/auth.middleware');

const router = express.Router();

// POST /api/pgs — add a new PG (auth required)
router.post('/', requireAuth, pgController.createPg);

// POST /api/pgs/:id/photos — upload a photo for this PG (auth required, multipart/form-data)
router.post('/:id/photos', requireAuth, photoUploadMiddleware, uploadPhoto);

// IMPORTANT: specific paths must come BEFORE parameterised paths.
// If '/:id' were declared first, GET /api/pgs/recent would match it with id="recent".
router.get('/recent', pgController.recentPgs);

// GET /api/pgs/:id/summary — AI-generated summary + tags (Phase 8, cached 24h)
router.get('/:id/summary', pgController.getPgSummary);

// GET /api/pgs/:id/trend — monthly rating trend for the last 12 months (Phase 9)
router.get('/:id/trend', pgController.getPgTrend);

// GET /api/pgs/:id — single PG detail
router.get('/:id', pgController.getPgById);

// GET /api/pgs?state=&city=&area=&page=&limit= — search
router.get('/', pgController.searchPgs);

module.exports = router;
