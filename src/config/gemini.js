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

Your job is to write a 3-sentence summary AND extract sentiment tags.

RULES FOR SUMMARY:
- Write in third person ("Most residents...", "Reviewers mention...", "Common complaints include...")
- Sentence 1: What residents generally liked or the overall vibe
- Sentence 2: What residents commonly complained about or warned against
- Sentence 3: One concrete fact — average price range, standout rating, or a specific pattern you noticed
- Never say "the reviews say" or "based on the reviews" — just state it directly
- Never make up information not present in the reviews
- If there is only 1 review, base the summary only on that review without saying "most residents"
- Keep each sentence under 20 words
- Plain text only — no bullet points, no headers, no formatting

RULES FOR TAGS:
- 2-4 word phrases extracted from common patterns in the reviews
- Maximum 5 tags total
- Mix of positive and negative based on review sentiment
- Examples: "good food", "noisy at night", "helpful owner", "overpriced", "clean rooms"

Return your response as a JSON object in this exact format:
{
  "summary": "three sentence summary here",
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
