import { createContext, useContext, useEffect, useState } from 'react'
import { apiGet, apiPost } from '../api/client'

// React Context — a way to share state across components without "prop drilling"
// (passing the same prop down through many layers). Any component anywhere in the
// tree can call useAuth() to read the current user and call login/register/logout.
const AuthContext = createContext(null)


export function AuthProvider({ children }) {
  // user: the logged-in user object {id, name, email, created_at}, or null if logged out
  // loading: true while we're still figuring out who the user is on first app load
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  // On app boot, ask the backend "do I have a valid session?" via /api/auth/me.
  // If the access cookie is present and valid → setUser. Otherwise → user stays null.
  useEffect(() => {
    apiGet('/api/auth/me')
      .then((data) => setUser(data.user))
      .catch(() => setUser(null))
      .finally(() => setLoading(false))
  }, [])

  async function login(email, password) {
    const data = await apiPost('/api/auth/login', { email, password })
    setUser(data.user)
  }

  async function register(name, email, password) {
    const data = await apiPost('/api/auth/register', { name, email, password })
    setUser(data.user)
  }

  async function logout() {
    await apiPost('/api/auth/logout')
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}


// Custom hook — components call useAuth() to read auth state and methods.
// Cleaner than importing AuthContext + useContext separately every time.
export function useAuth() {
  return useContext(AuthContext)
}