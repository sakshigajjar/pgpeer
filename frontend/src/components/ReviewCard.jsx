import StarRating from './StarRating'

function ReviewCard({ review, onUpvote, isLoggedIn, upvotedNow }) {
  const accountAge = formatAccountAge(review.user.created_at)

  return (
    <article className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl p-5 shadow-sm">

      {/* Ratings — small stars + label, wrapped inline */}
      <div className="flex flex-wrap gap-x-5 gap-y-2 mb-3">
        <RatingLine label="Food"        value={review.rating_food} />
        <RatingLine label="Cleanliness" value={review.rating_cleanliness} />
        <RatingLine label="Owner"       value={review.rating_owner} />
        <RatingLine label="Value"       value={review.rating_value} />
      </div>

      {/* Price + duration + status */}
      <p className="text-sm text-stone-600 dark:text-stone-400 mb-3">
        <span className="font-semibold text-stone-900 dark:text-stone-100">
          ₹{review.monthly_price.toLocaleString('en-IN')}
        </span>
        <span className="text-stone-400 dark:text-stone-500">/month</span>
        <span className="mx-2 text-stone-300 dark:text-stone-700">·</span>
        Stayed {review.stay_duration} {review.stay_duration === 1 ? 'month' : 'months'}
        <span className="mx-2 text-stone-300 dark:text-stone-700">·</span>
        {review.currently_living ? (
          <span className="text-emerald-700 dark:text-emerald-400 font-medium">Currently living</span>
        ) : (
          <span>Past resident</span>
        )}
      </p>

      <p className="text-stone-800 dark:text-stone-200 mb-4 leading-relaxed">{review.review_text}</p>

      {/* Footer — reviewer + upvote button */}
      <div className="flex items-center justify-between pt-3 border-t border-stone-100 dark:border-stone-800">
        <p className="text-xs text-stone-500 dark:text-stone-400">
          <span className="font-medium text-stone-700 dark:text-stone-300">{review.user.name}</span>
          <span className="mx-1.5 text-stone-300 dark:text-stone-700">·</span>
          {accountAge}
        </p>

        <button
          onClick={() => onUpvote(review.id)}
          disabled={!isLoggedIn}
          title={isLoggedIn ? 'Mark as helpful' : 'Login to upvote'}
          className={`px-3 py-1 text-sm rounded-md border transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
            upvotedNow
              ? 'bg-rose-600 text-white border-rose-600 hover:bg-rose-700'
              : 'bg-white dark:bg-stone-800 text-stone-700 dark:text-stone-200 border-stone-300 dark:border-stone-600 hover:bg-stone-50 dark:hover:bg-stone-700'
          }`}
        >
          ▲ {upvotedNow ? 'Upvoted' : 'Helpful'} ({review.upvotes})
        </button>
      </div>
    </article>
  )
}


function RatingLine({ label, value }) {
  return (
    <div className="flex items-center gap-1.5">
      <StarRating value={value} size={14} />
      <span className="text-xs text-stone-600 dark:text-stone-400">{label}</span>
    </div>
  )
}


function formatAccountAge(createdAt) {
  const months = Math.floor(
    (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24 * 30)
  )
  if (months < 1)  return 'joined this month'
  if (months < 12) return `joined ${months} ${months === 1 ? 'month' : 'months'} ago`
  const years = Math.floor(months / 12)
  return `joined ${years} ${years === 1 ? 'year' : 'years'} ago`
}


export default ReviewCard