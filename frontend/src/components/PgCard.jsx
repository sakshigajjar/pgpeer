import { Link } from 'react-router-dom'

function LocationIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
         className="inline-block flex-shrink-0">
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  )
}


function PgCard({ pg }) {
  return (
    <Link
      to={`/pgs/${pg.id}`}
      className="group block bg-white dark:bg-stone-900
                 border border-stone-200 dark:border-stone-800
                 rounded-xl shadow-sm overflow-hidden no-underline
                 hover:shadow-lg hover:border-rose-300 dark:hover:border-rose-700
                 hover:-translate-y-0.5 transition-all duration-200"
    >
      {/* Top accent stripe — visual interest without being loud */}
      <div className="h-1 bg-gradient-to-r from-rose-400 to-amber-400" />

      <div className="p-5">
        <h3 className="text-lg font-semibold text-stone-900 dark:text-stone-100 mb-2
                       line-clamp-1 group-hover:text-rose-600 dark:group-hover:text-rose-400
                       transition-colors">
          {pg.name}
        </h3>

        <p className="text-sm text-stone-600 dark:text-stone-400 mb-1 flex items-center gap-1.5">
          <LocationIcon />
          <span>{pg.area}, {pg.city}</span>
        </p>

        <p className="text-xs text-stone-500 dark:text-stone-500 ml-5">
          {pg.state}
        </p>
      </div>
    </Link>
  )
}

export default PgCard