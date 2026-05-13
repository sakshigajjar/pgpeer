const { query, transaction } = require('../config/db');
const { regenerateSummary } = require('../utils/summary');

const MAX_MONTHLY_PRICE = 500_000;          // ₹5 lakh — sanity ceiling
const MAX_STAY_DURATION_MONTHS = 240;       // 20 years — sanity ceiling
const MIN_WORD_COUNT = 30;                  // Locked rule #2

const FLAG_REASONS = ['spam', 'fake', 'abuse', 'inappropriate', 'other'];

// Word counter — splits on any whitespace (spaces, newlines, tabs).
// `\S+` matches sequences of non-whitespace characters; we count how many.
function countWords(text) {
  return (text.match(/\S+/g) || []).length;
}


// POST /api/reviews — auth required (user_id comes from req.user, never the body)
async function createReview(req, res, next) {
  try {
    const {
      pg_id,
      rating_food, rating_cleanliness, rating_owner, rating_value,
      monthly_price,
      review_text,
      stay_duration,
      currently_living,
    } = req.body;

    // --- Validation ---

    if (!Number.isInteger(pg_id) || pg_id < 1) {
      return res.status(400).json({ error: 'Valid pg_id is required' });
    }

    for (const field of ['rating_food', 'rating_cleanliness', 'rating_owner', 'rating_value']) {
      const v = req.body[field];
      if (!Number.isInteger(v) || v < 1 || v > 5) {
        return res.status(400).json({ error: `${field} must be an integer between 1 and 5` });
      }
    }

    if (!Number.isInteger(monthly_price) || monthly_price < 1 || monthly_price > MAX_MONTHLY_PRICE) {
      return res.status(400).json({
        error: `monthly_price must be a positive integer between 1 and ${MAX_MONTHLY_PRICE}`,
      });
    }

    if (typeof review_text !== 'string' || review_text.trim().length === 0) {
      return res.status(400).json({ error: 'review_text is required' });
    }
    const wordCount = countWords(review_text);
    if (wordCount < MIN_WORD_COUNT) {
      return res.status(400).json({
        error: `review_text must be at least ${MIN_WORD_COUNT} words (got ${wordCount})`,
      });
    }

    if (!Number.isInteger(stay_duration) || stay_duration < 1 || stay_duration > MAX_STAY_DURATION_MONTHS) {
      return res.status(400).json({
        error: `stay_duration must be a positive integer between 1 and ${MAX_STAY_DURATION_MONTHS} months`,
      });
    }

    if (typeof currently_living !== 'boolean') {
      return res.status(400).json({ error: 'currently_living must be a boolean (true or false)' });
    }

    // --- Insert + invalidate Gemini summary cache for this PG, atomically ---
    let review;
    try {
      review = await transaction(async (client) => {
        const insertResult = await client.query(
          `INSERT INTO reviews (
             pg_id, user_id,
             rating_food, rating_cleanliness, rating_owner, rating_value,
             monthly_price, review_text, stay_duration, currently_living
           )
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
           RETURNING id, pg_id, user_id,
                     rating_food, rating_cleanliness, rating_owner, rating_value,
                     monthly_price, review_text, stay_duration, currently_living,
                     upvotes, created_at`,
          [
            pg_id, req.user.id,
            rating_food, rating_cleanliness, rating_owner, rating_value,
            monthly_price, review_text.trim(), stay_duration, currently_living,
          ]
        );

        // Bust the Gemini summary cache for this PG — next /summary call regenerates.
        await client.query(
          `UPDATE pgs SET summary_generated_at = NULL WHERE id = $1`,
          [pg_id]
        );

        return insertResult.rows[0];
      });
    } catch (err) {
      if (err.code === '23503') {
        return res.status(404).json({ error: 'PG not found' });
      }
      if (err.code === '23505') {
        return res.status(409).json({ error: 'You have already reviewed this PG' });
      }
      throw err;
    }

    // Embed reviewer's public profile (locked rule #7: account age trust signal).
    const userResult = await query(
      'SELECT id, name, created_at FROM users WHERE id = $1',
      [req.user.id]
    );
    review.user = userResult.rows[0];

    // FIRE-AND-FORGET background regen of the AI summary. We deliberately
    // do NOT await this — the response goes out immediately. Gemini's 1-3s
    // call runs while the user is navigating back to the PG detail page.
    // If regen fails, the cache stays NULL and the next review submit
    // triggers another attempt.
    regenerateSummary(pg_id).catch((err) =>
      console.error('Background summary regen failed:', err.message)
    );

    return res.status(201).json({ review });
  } catch (err) {
    next(err);
  }
}


// POST /api/reviews/:id/upvote — toggle upvote on/off for the current user.
//   First call:  inserts a row,    increments reviews.upvotes by 1, returns { upvoted: true }
//   Second call: deletes that row, decrements reviews.upvotes by 1, returns { upvoted: false }
async function toggleUpvote(req, res, next) {
  try {
    const reviewId = parseInt(req.params.id, 10);
    if (!Number.isInteger(reviewId) || reviewId < 1) {
      return res.status(400).json({ error: 'Invalid review id' });
    }

    // Single query: confirm the review exists AND check whether THIS user has
    // upvoted it. LEFT JOIN means upvote_id is NULL when no upvote exists for
    // this (review, user) pair, but we still get the review row.
    const checkResult = await query(
      `SELECT r.id          AS review_id,
              ru.id         AS upvote_id
       FROM reviews r
       LEFT JOIN review_upvotes ru
         ON ru.review_id = r.id AND ru.user_id = $2
       WHERE r.id = $1`,
      [reviewId, req.user.id]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Review not found' });
    }

    const wasUpvoted = checkResult.rows[0].upvote_id !== null;

    // Counter and the upvote row stay in sync via a transaction.
    // If either statement fails, both revert — no orphan rows or mismatched counts.
    const newUpvotes = await transaction(async (client) => {
      if (wasUpvoted) {
        await client.query(
          'DELETE FROM review_upvotes WHERE review_id = $1 AND user_id = $2',
          [reviewId, req.user.id]
        );
        const r = await client.query(
          'UPDATE reviews SET upvotes = upvotes - 1 WHERE id = $1 RETURNING upvotes',
          [reviewId]
        );
        return r.rows[0].upvotes;
      } else {
        await client.query(
          'INSERT INTO review_upvotes (review_id, user_id) VALUES ($1, $2)',
          [reviewId, req.user.id]
        );
        const r = await client.query(
          'UPDATE reviews SET upvotes = upvotes + 1 WHERE id = $1 RETURNING upvotes',
          [reviewId]
        );
        return r.rows[0].upvotes;
      }
    });

    return res.json({ upvoted: !wasUpvoted, upvotes: newUpvotes });
  } catch (err) {
    // 23505 here means a race: between our SELECT check and INSERT, another
    // request also inserted (e.g., user double-clicked). Surface as 409.
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Concurrent upvote — please retry' });
    }
    next(err);
  }
}


// POST /api/reviews/:id/flag — report a review for moderation.
// Body: { reason: 'spam' | 'fake' | 'abuse' | 'inappropriate' | 'other' }
async function flagReview(req, res, next) {
  try {
    const reviewId = parseInt(req.params.id, 10);
    if (!Number.isInteger(reviewId) || reviewId < 1) {
      return res.status(400).json({ error: 'Invalid review id' });
    }

    const { reason } = req.body;
    if (!FLAG_REASONS.includes(reason)) {
      return res.status(400).json({
        error: `reason must be one of: ${FLAG_REASONS.join(', ')}`,
      });
    }

    let flag;
    try {
      const result = await query(
        `INSERT INTO review_flags (review_id, flagged_by, reason)
         VALUES ($1, $2, $3)
         RETURNING id, review_id, flagged_by, reason, created_at`,
        [reviewId, req.user.id, reason]
      );
      flag = result.rows[0];
    } catch (err) {
      if (err.code === '23503') {
        return res.status(404).json({ error: 'Review not found' });
      }
      if (err.code === '23505') {
        return res.status(409).json({ error: 'You have already flagged this review' });
      }
      throw err;
    }

    return res.status(201).json({ flag });
  } catch (err) {
    next(err);
  }
}


module.exports = { createReview, toggleUpvote, flagReview };
