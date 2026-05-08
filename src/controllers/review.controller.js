const { query } = require('../config/db');

const MAX_MONTHLY_PRICE = 500_000;          // ₹5 lakh — sanity ceiling
const MAX_STAY_DURATION_MONTHS = 240;       // 20 years — sanity ceiling
const MIN_WORD_COUNT = 30;                  // Locked rule #2

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

    // --- Insert ---
    // FK violation (23503) → 404 (PG doesn't exist).
    // UNIQUE violation (23505) → 409 (locked rule #1: one review per user per PG).
    let review;
    try {
      const result = await query(
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
      review = result.rows[0];
    } catch (err) {
      if (err.code === '23503') {
        return res.status(404).json({ error: 'PG not found' });
      }
      if (err.code === '23505') {
        return res.status(409).json({ error: 'You have already reviewed this PG' });
      }
      throw err;
    }

    // Embed the reviewer's public profile (id, name, account-creation date).
    // Account age is the trust signal (locked rule #7) — the frontend uses it
    // to render "Reviewer since 2024".
    const userResult = await query(
      'SELECT id, name, created_at FROM users WHERE id = $1',
      [req.user.id]
    );
    review.user = userResult.rows[0];

    return res.status(201).json({ review });
  } catch (err) {
    next(err);
  }
}


module.exports = { createReview };
