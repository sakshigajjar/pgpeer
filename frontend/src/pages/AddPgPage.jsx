import { useState, useEffect, useMemo, useId } from 'react'
import { useNavigate, Navigate, useLocation, Link } from 'react-router-dom'
import { apiGet, apiPost } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import { STATES, citiesForState } from '../config/locations'

const inputClass =
  'w-full rounded-md border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-rose-500 disabled:opacity-60 disabled:cursor-not-allowed'

const labelClass = 'block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1'


function AddPgPage() {
  const { user, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [name, setName]                     = useState('')
  const [address, setAddress]               = useState('')
  const [pgState, setPgState]               = useState('')
  const [city, setCity]                     = useState('')
  const [area, setArea]                     = useState('')
  const [googleMapsUrl, setGoogleMapsUrl]   = useState('')

  const [areaSuggestions, setAreaSuggestions] = useState([])
  const [duplicates, setDuplicates]           = useState(null)
  const [error, setError]                     = useState(null)
  const [submitting, setSubmitting]           = useState(false)

  // Stable unique id for the <datalist>. Lets React generate it — avoids
  // hardcoded ids that would collide if this component ever mounted twice.
  const areaListId = useId()

  // Cities dropdown cascades from the selected state. Memo avoids re-filtering
  // the 50-item CITIES array on every unrelated re-render.
  const cityOptions = useMemo(() => citiesForState(pgState), [pgState])

  // Fetch existing areas whenever the selected city changes. Powers the
  // <datalist> suggestions — user still types freely but sees canonical
  // options (avoids "Navrangpura" vs "Navrang Pura" drift).
  useEffect(() => {
    if (!city) {
      setAreaSuggestions([])
      return
    }
    apiGet(`/api/pgs/areas?city=${encodeURIComponent(city)}`)
      .then((data) => setAreaSuggestions(data.areas))
      .catch(() => setAreaSuggestions([]))
  }, [city])

  if (authLoading) return <p className="text-stone-500 dark:text-stone-400">Loading…</p>
  if (!user)       return <Navigate to="/login" state={{ from: location }} replace />

  // State picks reset the city — old city might not belong to the new state,
  // and we never want to leak a stale (state, city) pair to the backend.
  function handleStateChange(e) {
    setPgState(e.target.value)
    setCity('')
    setDuplicates(null)
  }

  async function submitPg(forceCreate) {
    setError(null)
    setDuplicates(null)
    setSubmitting(true)
    try {
      const body = {
        name,
        address,
        state:            pgState,
        city,
        area,
        google_maps_url:  googleMapsUrl,
      }
      if (forceCreate) body.force_create = true

      const data = await apiPost('/api/pgs', body)
      navigate(`/pgs/${data.pg.id}`)
    } catch (err) {
      // 409 possible_duplicate is a UI state, not an error banner. Show the
      // candidates so the user can either navigate to an existing PG or
      // confirm they want to add anyway.
      if (err.status === 409 && err.body?.error === 'possible_duplicate') {
        setDuplicates(err.body.candidates)
      } else {
        setError(err.body?.error || err.message)
      }
    } finally {
      setSubmitting(false)
    }
  }

  function handleSubmit(e) {
    e.preventDefault()
    submitPg(false)
  }

  return (
    <div className="max-w-xl mx-auto bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl p-8 shadow-sm">
      <h1 className="text-2xl font-bold tracking-tight text-stone-900 dark:text-stone-100 mb-1">
        Add a PG
      </h1>
      <p className="text-sm text-stone-500 dark:text-stone-400 mb-6">
        Help future students by adding a PG you know.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className={labelClass}>Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={200}
            className={inputClass}
          />
        </div>

        <div>
          <label className={labelClass}>Address</label>
          <input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            required
            maxLength={500}
            className={inputClass}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>State</label>
            <select
              value={pgState}
              onChange={handleStateChange}
              required
              className={inputClass}
            >
              <option value="">Select a state…</option>
              {STATES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>City</label>
            <select
              value={city}
              onChange={(e) => setCity(e.target.value)}
              required
              disabled={!pgState}
              className={inputClass}
            >
              <option value="">
                {pgState ? 'Select a city…' : 'Pick a state first'}
              </option>
              {cityOptions.map((c) => (
                <option key={c.name} value={c.name}>{c.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className={labelClass}>Area</label>
          <input
            value={area}
            onChange={(e) => setArea(e.target.value)}
            required
            maxLength={100}
            list={areaListId}
            disabled={!city}
            placeholder={city ? 'Type to search — pick an existing area or add a new one' : 'Pick a city first'}
            className={inputClass}
          />
          <datalist id={areaListId}>
            {areaSuggestions.map((a) => (
              <option key={a} value={a} />
            ))}
          </datalist>
        </div>

        <div>
          <label className={labelClass}>Google Maps link</label>
          <input
            type="url"
            value={googleMapsUrl}
            onChange={(e) => setGoogleMapsUrl(e.target.value)}
            required
            placeholder="https://maps.app.goo.gl/…"
            className={inputClass}
          />
          <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">
            Open the PG in Google Maps, tap Share → Copy link, and paste it here.
            Helps other users verify the PG exists.
          </p>
        </div>

        {duplicates && (
          <div className="rounded-md border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 p-4">
            <p className="text-sm font-medium text-amber-900 dark:text-amber-200 mb-2">
              A similar PG already exists. Did you mean one of these?
            </p>
            <ul className="text-sm space-y-1 mb-3">
              {duplicates.map((d) => (
                <li key={d.id}>
                  <Link
                    to={`/pgs/${d.id}`}
                    className="underline text-amber-900 dark:text-amber-100 hover:text-rose-600 dark:hover:text-rose-400"
                  >
                    {d.name}
                  </Link>
                  <span className="text-amber-700 dark:text-amber-300"> — {d.area}</span>
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => submitPg(true)}
              disabled={submitting}
              className="text-sm px-3 py-1.5 border border-amber-400 dark:border-amber-700 rounded-md bg-white dark:bg-stone-900 text-amber-900 dark:text-amber-100 hover:bg-amber-100 dark:hover:bg-amber-950 disabled:opacity-50"
            >
              {submitting ? 'Adding…' : 'None of these — add anyway'}
            </button>
          </div>
        )}

        {error && <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-md disabled:opacity-50 text-sm font-medium"
        >
          {submitting ? 'Adding…' : 'Add PG'}
        </button>
      </form>
    </div>
  )
}

export default AddPgPage