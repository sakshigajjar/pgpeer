const express = require('express');

const reviewController = require('../controllers/review.controller');
const { requireAuth } = require('../middleware/auth.middleware');

const router = express.Router();

// POST /api/reviews              — submit a review
router.post('/',           requireAuth, reviewController.createReview);

// POST /api/reviews/:id/upvote   — toggle upvote on/off
router.post('/:id/upvote', requireAuth, reviewController.toggleUpvote);

// POST /api/reviews/:id/flag     — report review for moderation
router.post('/:id/flag',   requireAuth, reviewController.flagReview);

module.exports = router;
