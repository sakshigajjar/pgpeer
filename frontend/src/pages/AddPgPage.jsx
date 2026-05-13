import { useState } from 'react'
import { useNavigate, Navigate, useLocation } from 'react-router-dom'
import { apiPost } from '../api/client'
import { useAuth } from '../auth/AuthContext'

const inputClass =
  'w-full rounded-md border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-rose-500'

const labelClass = 'block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1'


function AddPgPage() {
  const { user, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [name, setName]       = useState('')
  const [address, setAddress] = useState('')
  const [pgState, setPgState] = useState('')
  const [city, setCity]       = useState('')
  const [area, setArea]       = useState('')
  const [error, setError]           = useState(null)
  const [submitting, setSubmitting] = useState(false)

  if (authLoading) return <p className="text-stone-500 dark:text-stone-400">Loading…</p>
  if (!user)       return <Navigate to="/login" state={{ from: location }} replace />

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const data = await apiPost('/api/pgs', { name, address, state: pgState, city, area })
      navigate(`/pgs/${data.pg.id}`)
    } catch (err) {
      setError(err.body?.error || err.message)
    } finally {
      setSubmitting(false)
    }
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
            <input
              value={pgState}
              onChange={(e) => setPgState(e.target.value)}
              required
              maxLength={100}
              placeholder="Karnataka"
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>City</label>
            <input
              value={city}
              onChange={(e) => setCity(e.target.value)}
              required
              maxLength={100}
              placeholder="Bangalore"
              className={inputClass}
            />
          </div>
        </div>

        <div>
          <label className={labelClass}>Area</label>
          <input
            value={area}
            onChange={(e) => setArea(e.target.value)}
            required
            maxLength={100}
            placeholder="Indiranagar"
            className={inputClass}
          />
        </div>

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