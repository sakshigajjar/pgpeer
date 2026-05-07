const express = require('express');

const pgController = require('../controllers/pg.controller');
const { requireAuth } = require('../middleware/auth.middleware');

const router = express.Router();

// POST /api/pgs — add a new PG (auth required)
router.post('/', requireAuth, pgController.createPg);

// IMPORTANT: specific paths must come BEFORE parameterised paths.
// If '/:id' were declared first, GET /api/pgs/recent would match it with id="recent".
router.get('/recent', pgController.recentPgs);

// GET /api/pgs/:id — single PG detail
router.get('/:id', pgController.getPgById);

// GET /api/pgs?city=&area=&page=&limit= — search
router.get('/', pgController.searchPgs);

module.exports = router;
