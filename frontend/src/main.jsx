import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { AuthProvider } from './auth/AuthContext.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {/* AuthProvider wraps the whole app so every page can read the current user */}
    <AuthProvider>
      <App />
    </AuthProvider>
  </StrictMode>,
)