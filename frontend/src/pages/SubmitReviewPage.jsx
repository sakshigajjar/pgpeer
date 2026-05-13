import { useState } from 'react'
import { useParams, useNavigate, Navigate, useLocation } from 'react-router-dom'
import { apiPost } from '../api/client'
import { useAuth } from '../auth/AuthContext'

const inputClass =
  'w-full rounded-md border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-rose-500'

const labelClass = 'block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1'


/**
 * Interactive star rating input. Hovering previews the rating; clicking sets it.
 * 5 buttons, each a star SVG. Filled when n ≤ display value (= hover ?? actual).
 */
function RatingStarsInput({ value, onChange, label }) {
  const [hover, setHover] = useState(null)
  const display = hover ?? value

  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <span className="text-sm font-medium text-stone-700 dark:text-stone-300">{label}</span>

      <div className="flex gap-1" onMouseLeave={() => setHover(null)}>
        {[1, 2, 3, 4, 5].map((n) => {
          const filled = n <= display
          return (
            <button
              key={n}
              type="button"
              onClick={() => onChange(n)}
              onMouseEnter={() => setHover(n)}
              className="cursor-pointer transition-transform hover:scale-110"
              aria-label={`Rate ${label} ${n} of 5`}
            >
              <svg
                width="26"
                height="26"
                viewBox="0 0 24 24"
                fill={filled ? 'currentColor' : 'none'}
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinejoin="round"
                className={filled ? 'text-amber-400' : 'text-stone-300 dark:text-stone-600'}
              >
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
            </button>
          )
        })}
      </div>
    </div>
  )
}


function SubmitReviewPage() {
  const { id } = useParams()
  const { user, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [ratingFood, setRatingFood]               = useState(3)
  const [ratingCleanliness, setRatingCleanliness] = useState(3)
  const [ratingOwner, setRatingOwner]             = useState(3)
  const [ratingValue, setRatingValue]             = useState(3)
  const [monthlyPrice, setMonthlyPrice]           = useState('')
  const [stayDuration, setStayDuration]           = useState('')
  const [currentlyLiving, setCurrentlyLiving]     = useState(false)
  const [reviewText, setReviewText]               = useState('')
  const [error, setError]                         = useState(null)
  const [submitting, setSubmitting]               = useState(false)

  if (authLoading) return <p className="text-stone-500 dark:text-stone-400">Loading…</p>
  if (!user)       return <Navigate to="/login" state={{ from: location }} replace />

  const wordCount      = (reviewText.match(/\S+/g) || []).length
  const MIN_WORDS      = 30
  const wordCountValid = wordCount >= MIN_WORDS

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await apiPost('/api/reviews', {
        pg_id: parseInt(id, 10),
        rating_food: ratingFood,
        rating_cleanliness: ratingCleanliness,
        rating_owner: ratingOwner,
        rating_value: ratingValue,
        monthly_price: parseInt(monthlyPrice, 10),
        review_text: reviewText,
        stay_duration: parseInt(stayDuration, 10),
        currently_living: currentlyLiving,
      })
      navigate(`/pgs/${id}`)
    } catch (err) {
      setError(err.body?.error || err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl p-8 shadow-sm">
      <h1 className="text-2xl font-bold tracking-tight text-stone-900 dark:text-stone-100 mb-1">
        Write a review
      </h1>
      <p className="text-sm text-stone-500 dark:text-stone-400 mb-6">
        Share your honest experience to help future students.
      </p>

      <form onSubmit={handleSubmit} className="space-y-6">

        {/* === Ratings === */}
        <fieldset className="border border-stone-200 dark:border-stone-700 rounded-xl p-4">
          <legend className="px-2 text-sm font-medium text-stone-700 dark:text-stone-300">Ratings</legend>
          <div className="divide-y divide-stone-100 dark:divide-stone-800">
            <RatingStarsInput label="Food"             value={ratingFood}        onChange={setRatingFood} />
            <RatingStarsInput label="Cleanliness"      value={ratingCleanliness} onChange={setRatingCleanliness} />
            <RatingStarsInput label="Owner behaviour"  value={ratingOwner}       onChange={setRatingOwner} />
            <RatingStarsInput label="Value for money"  value={ratingValue}       onChange={setRatingValue} />
          </div>
        </fieldset>

        {/* === Price + duration === */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Monthly price (₹)</label>
            <input
              type="number"
              value={monthlyPrice}
              onChange={(e) => setMonthlyPrice(e.target.value)}
              required
              min={1}
              max={500000}
              placeholder="12000"
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Stay duration (months)</label>
            <input
              type="number"
              value={stayDuration}
              onChange={(e) => setStayDuration(e.target.value)}
              required
              min={1}
              max={240}
              placeholder="6"
              className={inputClass}
            />
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm text-stone-700 dark:text-stone-300">
          <input
            type="checkbox"
            checked={currentlyLiving}
            onChange={(e) => setCurrentlyLiving(e.target.checked)}
            className="rounded text-rose-600 focus:ring-rose-500 dark:bg-stone-800 dark:border-stone-600"
          />
          I currently live here
        </label>

        {/* === Review text with live word count === */}
        <div>
          <label className={labelClass}>Your review</label>
          <textarea
            value={reviewText}
            onChange={(e) => setReviewText(e.target.value)}
            required
            rows={7}
            placeholder="Share your honest experience — food, cleanliness, owner, location, what you wish you'd known…"
            className={`${inputClass} resize-y`}
          />
          <p className={`text-xs mt-1 ${wordCountValid ? 'text-stone-500 dark:text-stone-400' : 'text-rose-600 dark:text-rose-400'}`}>
            {wordCount} word{wordCount === 1 ? '' : 's'}
            {wordCountValid
              ? ' ✓'
              : ` — ${MIN_WORDS - wordCount} more needed (minimum ${MIN_WORDS})`}
          </p>
        </div>

        {error && <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>}

        <button
          type="submit"
          disabled={submitting || !wordCountValid}
          className="w-full py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-md disabled:bg-stone-300 dark:disabled:bg-stone-700 disabled:cursor-not-allowed text-sm font-medium"
        >
          {submitting ? 'Submitting…' : 'Submit review'}
        </button>
      </form>
    </div>
  )
}

export default SubmitReviewPage