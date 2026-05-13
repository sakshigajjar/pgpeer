import { useEffect, useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'


// Lucide-style sun / moon icons inline so we don't add an icon library dependency.
function SunIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2" /><path d="M12 20v2" />
      <path d="m4.93 4.93 1.41 1.41" /><path d="m17.66 17.66 1.41 1.41" />
      <path d="M2 12h2" /><path d="M20 12h2" />
      <path d="m6.34 17.66-1.41 1.41" /><path d="m19.07 4.93-1.41 1.41" />
    </svg>
  )
}

function MoonIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
    </svg>
  )
}

// Tiny house mark for the brand. Inline SVG keeps it crisp at any size.
function BrandMark() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  )
}


function useTheme() {
  // 'light' or 'dark'. Reads the class that index.html's inline script already set.
  const [theme, setTheme] = useState(() =>
    typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
      ? 'dark' : 'light'
  )

  useEffect(() => {
    const root = document.documentElement
    if (theme === 'dark') root.classList.add('dark')
    else                  root.classList.remove('dark')
    localStorage.setItem('theme', theme)
  }, [theme])

  return [theme, setTheme]
}


const navLinkClass = ({ isActive }) =>
  `text-sm font-medium no-underline transition-colors ${
    isActive
      ? 'text-rose-600 dark:text-rose-400'
      : 'text-stone-600 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100'
  }`


function Navbar() {
  const { user, loading, logout } = useAuth()
  const navigate = useNavigate()
  const [theme, setTheme] = useTheme()

  async function handleLogout() {
    await logout()
    navigate('/')
  }

  return (
    <nav className="bg-white dark:bg-stone-900 border-b border-stone-200 dark:border-stone-800 sticky top-0 z-10">
      <div className="max-w-5xl mx-auto px-4 h-14 flex items-center gap-6">

        {/* Brand */}
        <Link to="/" className="flex items-center gap-2 text-rose-600 dark:text-rose-400 no-underline">
          <BrandMark />
          <span className="text-lg font-bold tracking-tight">PGPeer</span>
        </Link>

        {/* Primary nav (hidden on mobile) */}
        <div className="hidden sm:flex gap-6">
          <NavLink to="/"        end className={navLinkClass}>Home</NavLink>
          <NavLink to="/search"      className={navLinkClass}>Search</NavLink>
          <NavLink to="/pgs/new"     className={navLinkClass}>Add PG</NavLink>
        </div>

        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          {/* Theme toggle */}
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            aria-label="Toggle theme"
            className="p-2 rounded-md text-stone-600 hover:bg-stone-100 dark:text-stone-300 dark:hover:bg-stone-800"
          >
            {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
          </button>

          {loading ? null : user ? (
            <>
              <span className="hidden sm:inline text-sm text-stone-600 dark:text-stone-400">
                Hi, {user.name}
              </span>
              <button
                onClick={handleLogout}
                className="px-3 py-1.5 text-sm border border-stone-300 dark:border-stone-700 rounded-md text-stone-700 dark:text-stone-200 hover:bg-stone-50 dark:hover:bg-stone-800"
              >
                Logout
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="text-sm text-stone-700 dark:text-stone-300 hover:text-stone-900 dark:hover:text-stone-100 no-underline">
                Login
              </Link>
              <Link
                to="/register"
                className="px-3 py-1.5 text-sm bg-rose-600 hover:bg-rose-700 text-white rounded-md no-underline font-medium"
              >
                Sign up
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  )
}

export default Navbar