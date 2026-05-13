import { BrowserRouter, Routes, Route, Link } from 'react-router-dom'

import Navbar from './components/Navbar'
import HomePage from './pages/HomePage'
import SearchPage from './pages/SearchPage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import AddPgPage from './pages/AddPgPage'
import PgDetailPage from './pages/PgDetailPage'
import SubmitReviewPage from './pages/SubmitReviewPage'

function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen flex flex-col bg-stone-50 dark:bg-stone-950 text-stone-900 dark:text-stone-100">
        <Navbar />

        <main className="flex-1 w-full max-w-5xl mx-auto px-4 py-8">
          <Routes>
            <Route path="/"               element={<HomePage />} />
            <Route path="/search"         element={<SearchPage />} />
            <Route path="/login"          element={<LoginPage />} />
            <Route path="/register"       element={<RegisterPage />} />
            <Route path="/pgs/new"        element={<AddPgPage />} />
            <Route path="/pgs/:id"        element={<PgDetailPage />} />
            <Route path="/pgs/:id/review" element={<SubmitReviewPage />} />
            <Route path="*" element={<h1 className="text-2xl font-semibold">Page not found</h1>} />
          </Routes>
        </main>

        <footer className="border-t border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 py-8 mt-12">
          <div className="max-w-5xl mx-auto px-4 grid grid-cols-1 sm:grid-cols-3 gap-6 text-sm">
            <div>
              <p className="font-bold text-rose-600 dark:text-rose-400 mb-2">PGPeer</p>
              <p className="text-stone-600 dark:text-stone-400">
                Honest PG reviews from people who actually lived there.
              </p>
            </div>
            <div>
              <p className="font-medium mb-2">Explore</p>
              <ul className="space-y-1 text-stone-600 dark:text-stone-400">
                <li><Link to="/" className="hover:text-rose-600 dark:hover:text-rose-400 no-underline">Recent PGs</Link></li>
                <li><Link to="/search" className="hover:text-rose-600 dark:hover:text-rose-400 no-underline">Search</Link></li>
                <li><Link to="/pgs/new" className="hover:text-rose-600 dark:hover:text-rose-400 no-underline">Add a PG</Link></li>
              </ul>
            </div>
            <div>
              <p className="font-medium mb-2">Project</p>
              <ul className="space-y-1 text-stone-600 dark:text-stone-400">
                <li>
                  <a href="https://github.com/sakshigajjar/pgpeer"
                     className="hover:text-rose-600 dark:hover:text-rose-400 no-underline">
                    GitHub
                  </a>
                </li>
                <li>Built by Sakshi Gajjar</li>
              </ul>
            </div>
          </div>
        </footer>
      </div>
    </BrowserRouter>
  )
}

export default App