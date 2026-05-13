import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { apiGet } from '../api/client'
import PgCard from '../components/PgCard'

function HomePage() {
  const navigate = useNavigate()
  const [heroQuery, setHeroQuery] = useState('')

  const [pgs, setPgs]         = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)

  useEffect(() => {
    apiGet('/api/pgs/recent')
      .then((data) => setPgs(data.pgs))
      .catch((err) => setError(err.body?.error || err.message))
      .finally(() => setLoading(false))
  }, [])

  function handleHeroSearch(e) {
    e.preventDefault()
    const q = heroQuery.trim()
    if (!q) return
    // We don't know if the user typed a city or an area — just pass as 'city'
    // (the backend's ILIKE is forgiving). Could route smarter later.
    navigate(`/search?city=${encodeURIComponent(q)}`)
  }

  return (
    <div>
      {/* ===== Hero ===== */}
      <section className="relative overflow-hidden rounded-2xl
                          bg-gradient-to-br from-rose-100 via-rose-50 to-amber-50
                          dark:from-rose-950/40 dark:via-stone-900 dark:to-stone-900
                          border border-rose-100 dark:border-stone-800
                          px-6 py-12 sm:py-16 mb-12">
        <div className="max-w-2xl">
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight
                         text-stone-900 dark:text-stone-50
                         leading-tight mb-4">
            Honest PG reviews <br className="hidden sm:block" />
            from people who <span className="text-rose-600 dark:text-rose-400">lived there</span>.
          </h1>

          <p className="text-base sm:text-lg text-stone-600 dark:text-stone-300 mb-8 max-w-xl">
            Find the right Paying Guest accommodation across India — written by students and renters, not landlords.
          </p>

          <form onSubmit={handleHeroSearch} className="flex gap-2 max-w-md">
            <input
              type="text"
              value={heroQuery}
              onChange={(e) => setHeroQuery(e.target.value)}
              placeholder="Try 'Bangalore' or 'Koramangala'"
              className="flex-1 rounded-md border border-stone-300 dark:border-stone-700
                         bg-white dark:bg-stone-900
                         px-4 py-2.5 text-sm
                         focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-rose-500"
            />
            <button
              type="submit"
              className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-md text-sm font-medium"
            >
              Search
            </button>
          </form>
        </div>
      </section>

      {/* ===== Recently added ===== */}
      <div className="flex items-baseline justify-between mb-5">
        <h2 className="text-2xl font-bold tracking-tight text-stone-900 dark:text-stone-100">
          Recently added
        </h2>
        <Link to="/search" className="text-sm text-rose-600 dark:text-rose-400 hover:underline">
          Browse all →
        </Link>
      </div>

      {loading && <p className="text-stone-500 dark:text-stone-400">Loading…</p>}

      {error && (
        <p className="text-rose-600 dark:text-rose-400">Failed to load: {error}</p>
      )}

      {!loading && !error && pgs.length === 0 && (
        <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl p-10 text-center">
          <p className="text-stone-600 dark:text-stone-400 mb-3">No PGs yet.</p>
          <Link
            to="/pgs/new"
            className="inline-block px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-md text-sm font-medium no-underline"
          >
            Be the first to add one
          </Link>
        </div>
      )}

      {!loading && !error && pgs.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {pgs.map((pg) => <PgCard key={pg.id} pg={pg} />)}
        </div>
      )}
    </div>
  )
}

export default HomePage