import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { apiGet } from '../api/client'
import PgCard from '../components/PgCard'

const PAGE_LIMIT = 20

const inputClass =
  'flex-1 min-w-0 sm:min-w-[160px] rounded-md border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-rose-500'

function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams()

  const [stateInput, setStateInput] = useState(searchParams.get('state') || '')
  const [cityInput,  setCityInput]  = useState(searchParams.get('city')  || '')
  const [areaInput,  setAreaInput]  = useState(searchParams.get('area')  || '')

  const queryState = searchParams.get('state') || ''
  const queryCity  = searchParams.get('city')  || ''
  const queryArea  = searchParams.get('area')  || ''
  const queryPage  = parseInt(searchParams.get('page'), 10) || 1

  const hasFilters = Boolean(queryState || queryCity || queryArea)

  const [pgs, setPgs]         = useState([])
  const [total, setTotal]     = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState(null)

  useEffect(() => {
    if (!hasFilters) {
      setPgs([])
      setTotal(0)
      return
    }
    const params = new URLSearchParams()
    if (queryState) params.set('state', queryState)
    if (queryCity)  params.set('city',  queryCity)
    if (queryArea)  params.set('area',  queryArea)
    params.set('page',  queryPage)
    params.set('limit', PAGE_LIMIT)

    setLoading(true)
    setError(null)
    apiGet(`/api/pgs?${params.toString()}`)
      .then((data) => {
        setPgs(data.pgs)
        setTotal(data.total)
      })
      .catch((err) => setError(err.body?.error || err.message))
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryState, queryCity, queryArea, queryPage])

  function handleSubmit(e) {
    e.preventDefault()
    const params = new URLSearchParams()
    if (stateInput.trim()) params.set('state', stateInput.trim())
    if (cityInput.trim())  params.set('city',  cityInput.trim())
    if (areaInput.trim())  params.set('area',  areaInput.trim())
    setSearchParams(params)
  }

  function goToPage(p) {
    const params = new URLSearchParams(searchParams)
    params.set('page', p)
    setSearchParams(params)
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_LIMIT))

  return (
    <div>
      <h1 className="text-3xl font-bold tracking-tight text-stone-900 dark:text-stone-100 mb-6">
        Search PGs
      </h1>

      <form onSubmit={handleSubmit} className="flex flex-wrap gap-2 mb-8">
        <input
          placeholder="State (e.g., Karnataka)"
          value={stateInput}
          onChange={(e) => setStateInput(e.target.value)}
          className={inputClass}
        />
        <input
          placeholder="City (e.g., Bangalore)"
          value={cityInput}
          onChange={(e) => setCityInput(e.target.value)}
          className={inputClass}
        />
        <input
          placeholder="Area (e.g., Indiranagar)"
          value={areaInput}
          onChange={(e) => setAreaInput(e.target.value)}
          className={inputClass}
        />
        <button
          type="submit"
          className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-md text-sm font-medium"
        >
          Search
        </button>
      </form>

      {!hasFilters && (
        <p className="text-stone-500 dark:text-stone-400">Enter at least one filter above to search.</p>
      )}

      {hasFilters && loading && <p className="text-stone-500 dark:text-stone-400">Loading…</p>}

      {hasFilters && error && (
        <p className="text-rose-600 dark:text-rose-400">Failed: {error}</p>
      )}

      {hasFilters && !loading && !error && pgs.length === 0 && (
        <p className="text-stone-500 dark:text-stone-400">No PGs match your search.</p>
      )}

      {hasFilters && !loading && !error && pgs.length > 0 && (
        <>
          <p className="text-sm text-stone-500 dark:text-stone-400 mb-4">
            {total} result{total !== 1 ? 's' : ''}
            {totalPages > 1 && <> · page {queryPage} of {totalPages}</>}
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mb-8">
            {pgs.map((pg) => <PgCard key={pg.id} pg={pg} />)}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => goToPage(queryPage - 1)}
                disabled={queryPage <= 1}
                className="px-4 py-2 text-sm border border-stone-300 dark:border-stone-600 rounded-md text-stone-700 dark:text-stone-200 hover:bg-stone-50 dark:hover:bg-stone-800 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                ← Previous
              </button>
              <span className="text-sm text-stone-600 dark:text-stone-400">
                {queryPage} / {totalPages}
              </span>
              <button
                onClick={() => goToPage(queryPage + 1)}
                disabled={queryPage >= totalPages}
                className="px-4 py-2 text-sm border border-stone-300 dark:border-stone-600 rounded-md text-stone-700 dark:text-stone-200 hover:bg-stone-50 dark:hover:bg-stone-800 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default SearchPage