const { query } = require('../config/db')
const { summaryModel, buildSummaryPrompt } = require('../config/gemini')

// Regenerates the AI summary for a PG and writes it to the cache.
//
// Used by createReview as a FIRE-AND-FORGET background task:
//   regenerateSummary(pgId).catch(err => console.error(err))
//
// Behaviour:
//   - PG has zero reviews → returns { summary: null, tags: [] }, does NOT touch DB
//   - Success                → writes { ai_summary, summary_generated_at } to pgs
//   - Gemini / parse failure → throws; the caller logs and moves on. Cache stays
//                              as it was (NULL after the createReview transaction)
//                              and will only be repopulated on the NEXT review submit.
async function regenerateSummary(pgId) {
  const reviewsResult = await query(
    `SELECT rating_food, rating_cleanliness, rating_owner, rating_value,
            monthly_price, review_text, stay_duration, currently_living
     FROM reviews
     WHERE pg_id = $1
     ORDER BY created_at DESC`,
    [pgId]
  )
  const reviews = reviewsResult.rows

  if (reviews.length === 0) {
    return { summary: null, tags: [] }
  }

  const prompt = buildSummaryPrompt(reviews)
  const result = await summaryModel.generateContent(prompt)
  const raw = result.response.text()
  const parsed = JSON.parse(raw)

  // Gemini occasionally returns weird JSON; reject anything not matching our shape.
  if (typeof parsed.summary !== 'string' || !Array.isArray(parsed.tags)) {
    throw new Error('Gemini response missing expected fields')
  }

  await query(
    `UPDATE pgs
     SET ai_summary = $1, summary_generated_at = NOW()
     WHERE id = $2`,
    [JSON.stringify(parsed), pgId]
  )

  return parsed
}

module.exports = { regenerateSummary }