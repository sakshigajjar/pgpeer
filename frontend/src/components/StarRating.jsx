// Display-only star rating. For interactive star input (SubmitReviewPage),
// see RatingStarsInput in that file.

function StarRating({ value, max = 5, size = 16 }) {
  return (
    <div className="inline-flex items-center gap-0.5" aria-label={`${value} of ${max} stars`}>
      {Array.from({ length: max }, (_, i) => {
        const filled = i < value
        return (
          <svg
            key={i}
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill={filled ? 'currentColor' : 'none'}
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
            className={filled ? 'text-amber-400' : 'text-stone-300 dark:text-stone-700'}
          >
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
          </svg>
        )
      })}
    </div>
  )
}

export default StarRating