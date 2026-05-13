import { useState } from 'react'
import { useNavigate, Link, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import AuthBrandPanel from '../components/AuthBrandPanel'

const inputClass =
  'w-full rounded-md border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-rose-500'

const labelClass = 'block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1'


function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const intendedFrom = location.state?.from?.pathname || '/'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await login(email, password)
      navigate(intendedFrom, { replace: true })
    } catch (err) {
      setError(err.body?.error || err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="grid md:grid-cols-12 gap-0 items-stretch min-h-[75vh] rounded-2xl overflow-hidden border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 shadow-sm">

      {/* LEFT — form takes 7/12 */}
      <div className="md:col-span-7 p-8 sm:p-12 flex flex-col justify-center">
        <div className="w-full max-w-md mx-auto">
          <h1 className="text-2xl font-bold tracking-tight text-stone-900 dark:text-stone-100 mb-6">
            Welcome back
          </h1>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className={labelClass}>Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                autoComplete="current-password"
                className={inputClass}
              />
            </div>

            {error && <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>}

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-md disabled:opacity-50 text-sm font-medium"
            >
              {submitting ? 'Logging in…' : 'Log in'}
            </button>
          </form>

          <div className="my-6 flex items-center gap-3 text-xs text-stone-400 dark:text-stone-500">
            <hr className="flex-1 border-stone-200 dark:border-stone-700" />
            <span>OR</span>
            <hr className="flex-1 border-stone-200 dark:border-stone-700" />
          </div>

          <a
            href="/api/auth/google"
            className="flex items-center justify-center w-full py-2.5 bg-white dark:bg-stone-800 border border-stone-300 dark:border-stone-600 rounded-md text-stone-700 dark:text-stone-200 hover:bg-stone-50 dark:hover:bg-stone-700 text-sm font-medium no-underline"
          >
            Sign in with Google
          </a>

          <p className="text-sm text-stone-600 dark:text-stone-400 text-center mt-6">
            New here?{' '}
            <Link to="/register" className="text-rose-600 dark:text-rose-400 font-medium hover:underline">
              Create an account
            </Link>
          </p>
        </div>
      </div>

      {/* RIGHT — brand panel takes 5/12, with diagonal slant */}
      <div className="md:col-span-5 hidden md:block relative overflow-hidden">
        <AuthBrandPanel tagline="The reviews you wish existed before you signed your last PG lease." />
      </div>
    </div>
  )
}

export default LoginPage