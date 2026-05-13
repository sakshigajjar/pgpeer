const { GoogleGenerativeAI } = require('@google/generative-ai');

if (!process.env.GEMINI_API_KEY) {
  throw new Error('GEMINI_API_KEY is not set in .env');
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// gemini-2.5-flash-lite — lighter than -flash, less contended at peak times.
// Plenty for 3-sentence summaries. Switch to 'gemini-2.5-flash' if you ever need
// stronger reasoning (worth the contention risk for complex tasks).
// responseMimeType: 'application/json' → strict JSON output (no markdown fences).
// temperature: 0.3 → low randomness; same reviews give a similar summary each call.
const summaryModel = genAI.getGenerativeModel({
  model: 'gemini-2.5-flash-lite',
  generationConfig: {
    responseMimeType: 'application/json',
    temperature: 0.3,
  },
});


// Prompt template. {{reviews}} placeholder is filled by buildSummaryPrompt below.
const SUMMARY_PROMPT_TEMPLATE = `You are a helpful assistant that summarises student reviews of PG (Paying Guest) accommodations in India.

You will be given a list of reviews submitted by actual residents of a PG. Each review contains:
- Ratings (1-5) for food, cleanliness, owner behaviour, and value for money
- Monthly price paid (in INR)
- A text review written by the resident
- How long they stayed
- Whether they currently live there

Your job is to write a 5-6 sentence summary AND extract sentiment tags.

SUMMARY STRUCTURE (5-6 sentences, in this order):
1. Overall vibe — the headline impression residents share
2. Specific positives — call out which of food, cleanliness, owner behaviour, or value stood out, with concrete detail
3. Common complaints or recurring concerns
4. Specific negative patterns — noise, Wi-Fi, location, hidden costs, deposit issues — but only if reviewers actually mentioned them
5. One concrete numerical fact — average or range of monthly price, standout rating dimension, or typical stay duration
6. (Optional) Who this PG might suit best, or a final caveat — include only if reviews give a clear signal

GENERAL RULES:
- Write in third person ("Most residents...", "Reviewers mention...", "Common complaints include...")
- Never say "the reviews say" or "based on the reviews" — just state it directly
- Never make up information not present in the reviews
- If there is only 1 review, base the summary on it without saying "most residents"
- Each sentence under 25 words
- Plain text only — no bullet points, no headers, no formatting

RULES FOR TAGS:
- 2-4 word phrases extracted from common patterns in the reviews
- Maximum 5 tags total
- Mix of positive and negative based on review sentiment
- Examples: "good food", "noisy at night", "helpful owner", "overpriced", "clean rooms"

Return your response as a JSON object in this exact format:
{
  "summary": "five to six sentence summary here, flowing as one paragraph",
  "tags": ["tag one", "tag two", "tag three"]
}

Return only the JSON. No explanation. No markdown. No backticks.

REVIEWS:
{{reviews}}`;


// Builds the final prompt given an array of review rows.
// Each review is formatted into a labelled block; blocks are separated by "---".
function buildSummaryPrompt(reviews) {
  const reviewsText = reviews.map((r, i) => `Review ${i + 1}:
- Food: ${r.rating_food}/5 | Cleanliness: ${r.rating_cleanliness}/5 | Owner: ${r.rating_owner}/5 | Value: ${r.rating_value}/5
- Price paid: ₹${r.monthly_price}/month
- Stay duration: ${r.stay_duration} months
- Currently living: ${r.currently_living ? 'Yes' : 'No'}
- Review: ${r.review_text}`).join('\n---\n');

  return SUMMARY_PROMPT_TEMPLATE.replace('{{reviews}}', reviewsText);
}


module.exports = { summaryModel, buildSummaryPrompt };
