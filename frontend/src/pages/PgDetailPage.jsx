import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { apiGet, apiPost, apiPostForm } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import ReviewCard from '../components/ReviewCard'
import TrendChart from '../components/TrendChart'


function PencilIcon({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z" />
      <path d="m15 5 4 4" />
    </svg>
  )
}

function LocationIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="inline-block flex-shrink-0">
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  )
}


function PgDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [pg, setPg]           = useState(null)
  const [reviews, setReviews] = useState([])
  const [photos, setPhotos]   = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)

  const [summary, setSummary]               = useState(null)
  const [tags, setTags]                     = useState([])
  const [summaryLoading, setSummaryLoading] = useState(true)

  const [trend, setTrend] = useState([])

  const [upvotedNow, setUpvotedNow] = useState(new Set())

  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [uploadError, setUploadError]       = useState(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    apiGet(`/api/pgs/${id}`)
      .then((data) => {
        setPg(data.pg)
        setReviews(data.reviews)
        setPhotos(data.photos)
      })
      .catch((err) => setError(err.body?.error || err.message))
      .finally(() => setLoading(false))
  }, [id])

  useEffect(() => {
    setSummaryLoading(true)
    apiGet(`/api/pgs/${id}/summary`)
      .then((data) => {
        setSummary(data.summary)
        setTags(data.tags || [])
      })
      .catch(() => {
        setSummary(null)
        setTags([])
      })
      .finally(() => setSummaryLoading(false))
  }, [id])

  // Poll /summary every 3s while we have no summary but DO have reviews.
  // This auto-picks-up the result of the fire-and-forget regen kicked off by
  // a recent review submit — no manual refresh required.
  useEffect(() => {
    if (loading || summaryLoading) return
    if (summary) return
    if (reviews.length === 0) return

    let attempts = 0
    const MAX_ATTEMPTS = 10                       // 10 × 3s ≈ 30 seconds

    const intervalId = setInterval(async () => {
      attempts += 1
      if (attempts > MAX_ATTEMPTS) {
        clearInterval(intervalId)
        return
      }
      try {
        const data = await apiGet(`/api/pgs/${id}/summary`)
        if (data.summary) {
          setSummary(data.summary)
          setTags(data.tags || [])
          clearInterval(intervalId)
        }
      } catch { /* swallow — keep polling */ }
    }, 3000)

    return () => clearInterval(intervalId)
  }, [id, loading, summaryLoading, summary, reviews.length])

  useEffect(() => {
    apiGet(`/api/pgs/${id}/trend`)
      .then((data) => setTrend(data.trend))
      .catch(() => setTrend([]))
  }, [id])

  async function handleUpvote(reviewId) {
    try {
      const data = await apiPost(`/api/reviews/${reviewId}/upvote`)
      setReviews((rs) => rs.map((r) => (r.id === reviewId ? { ...r, upvotes: data.upvotes } : r)))
      setUpvotedNow((s) => {
        const next = new Set(s)
        if (data.upvoted) next.add(reviewId)
        else next.delete(reviewId)
        return next
      })
    } catch (err) {
      if (err.status === 401) navigate('/login')
    }
  }

  async function handlePhotoSelected(e) {
    const file = e.target.files[0]
    if (!file) return

    setUploadError(null)
    setUploadingPhoto(true)
    try {
      const formData = new FormData()
      formData.append('photo', file)
      const data = await apiPostForm(`/api/pgs/${id}/photos`, formData)
      setPhotos((ps) => [data.photo, ...ps])
    } catch (err) {
      setUploadError(err.body?.error || err.message)
    } finally {
      setUploadingPhoto(false)
      e.target.value = ''
    }
  }

  if (loading) return <p className="text-stone-500 dark:text-stone-400">Loading…</p>
  if (error)   return <p className="text-rose-600 dark:text-rose-400">{error}</p>
  if (!pg)     return null

  return (
    <div className="space-y-8">

      {/* ===== Gradient Hero Header ===== */}
      <header className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-rose-500 via-rose-600 to-amber-500 text-white px-8 py-10 sm:py-14">
        <h1 className="text-3xl sm:text-5xl font-bold tracking-tight mb-3">{pg.name}</h1>
        <p className="text-base sm:text-lg text-rose-50 flex items-start gap-2 mb-2 max-w-3xl">
          <span className="mt-1"><LocationIcon size={18} /></span>
          <span>{pg.address}, {pg.area}, {pg.city}, {pg.state}</span>
        </p>
        <p className="text-sm text-rose-100/85">
          Listed by <span className="font-medium text-white">{pg.added_by.name}</span> · joined {new Date(pg.added_by.created_at).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}
        </p>
      </header>

      {/* ===== Photos ===== */}
      <section>
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-lg font-semibold text-stone-900 dark:text-stone-100">
            Photos ({photos.length})
          </h2>

          {user && (
            <label className={`px-3 py-1.5 text-sm border border-stone-300 dark:border-stone-600 rounded-md bg-white dark:bg-stone-800 text-stone-700 dark:text-stone-200 hover:bg-stone-50 dark:hover:bg-stone-700 ${uploadingPhoto ? 'cursor-wait opacity-60' : 'cursor-pointer'}`}>
              {uploadingPhoto ? 'Uploading…' : '+ Add photo'}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handlePhotoSelected}
                disabled={uploadingPhoto}
                className="hidden"
              />
            </label>
          )}
        </div>

        {uploadError && <p className="text-sm text-rose-600 dark:text-rose-400 mb-2">{uploadError}</p>}

        {photos.length > 0 ? (
          <div className="flex gap-2 overflow-x-auto pb-2">
            {photos.map((photo) => (
              <img
                key={photo.id}
                src={photo.photo_url}
                alt=""
                className="h-56 rounded-xl flex-shrink-0 object-cover"
              />
            ))}
          </div>
        ) : (
          <p className="text-sm text-stone-500 dark:text-stone-400">
            {user ? 'No photos yet — upload the first one above.' : 'No photos yet.'}
          </p>
        )}
      </section>

      {/* ===== AI Summary ===== */}
      <section className="bg-rose-50 dark:bg-rose-950/30 border border-rose-100 dark:border-rose-900/50 rounded-2xl p-8">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-rose-700 dark:text-rose-300 mb-4 flex items-center gap-2">
          <span>AI Summary</span>
          {/* Tiny "regenerating" indicator while polling */}
          {!summaryLoading && !summary && reviews.length > 0 && (
            <span className="inline-block w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
          )}
        </h2>

        {summaryLoading ? (
          <p className="text-base text-stone-600 dark:text-stone-400">Generating summary…</p>
        ) : summary ? (
          <>
            <p className="text-base text-stone-800 dark:text-stone-100 leading-relaxed">
              {summary}
            </p>
            {tags.length > 0 && (
              <div className="flex gap-2 flex-wrap mt-6">
                {tags.map((tag, i) => (
                  <span key={i} className="bg-white dark:bg-stone-900 text-rose-700 dark:text-rose-300 px-4 py-1.5 rounded-full text-sm font-medium border border-rose-200 dark:border-rose-900">
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </>
        ) : reviews.length === 0 ? (
          <p className="text-base text-stone-600 dark:text-stone-400">
            No reviews yet. Submit one and Gemini will summarise.
          </p>
        ) : (
          <p className="text-base text-stone-600 dark:text-stone-400">
            Generating summary based on the latest reviews…
          </p>
        )}
      </section>

      {/* ===== Trend Chart ===== */}
      {trend.length > 0 && (
        <section className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-stone-900 dark:text-stone-100 mb-4">
            Rating trend
          </h2>
          <TrendChart data={trend} />
        </section>
      )}

      {/* ===== Reviews ===== */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-stone-900 dark:text-stone-100">
            Reviews ({reviews.length})
          </h2>

          {user ? (
            // Mobile only — on desktop the sticky CTA bottom-right handles this.
            <Link
              to={`/pgs/${id}/review`}
              className="md:hidden px-4 py-2 text-sm bg-rose-600 hover:bg-rose-700 text-white rounded-md no-underline font-medium"
            >
              Write a review
            </Link>
          ) : (
            <Link to="/login" className="text-sm text-rose-600 dark:text-rose-400 hover:underline">
              Log in to review
            </Link>
          )}
        </div>

        {reviews.length === 0 ? (
          <p className="text-stone-500 dark:text-stone-400">No reviews yet. Be the first.</p>
        ) : (
          <div className="space-y-4">
            {reviews.map((review) => (
              <ReviewCard
                key={review.id}
                review={review}
                onUpvote={handleUpvote}
                isLoggedIn={Boolean(user)}
                upvotedNow={upvotedNow.has(review.id)}
              />
            ))}
          </div>
        )}
      </section>

      {/* ===== Sticky "Write a review" CTA — desktop only ===== */}
      {user && (
        <Link
          to={`/pgs/${id}/review`}
          className="hidden md:flex fixed bottom-6 right-6 items-center gap-2 px-5 py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-full shadow-lg hover:shadow-xl transition-all hover:-translate-y-0.5 no-underline z-50 font-medium"
        >
          <PencilIcon size={18} />
          Write a review
        </Link>
      )}
    </div>
  )
}

export default PgDetailPage