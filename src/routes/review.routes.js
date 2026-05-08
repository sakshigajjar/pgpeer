const express = require('express');

const reviewController = require('../controllers/review.controller');
const { requireAuth } = require('../middleware/auth.middleware');

const router = express.Router();

// POST /api/reviews — submit a review (auth required)
router.post('/', requireAuth, reviewController.createReview);

module.exports = router;
