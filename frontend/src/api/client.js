// Single fetch wrapper used by every API call in the app.
//
// Three jobs:
//   1. Always send cookies (credentials: 'include')
//   2. Set Content-Type: application/json automatically (unless body is FormData,
//      which the browser sets itself with the right multipart boundary)
//   3. Auto-refresh on access-token expiry: when the backend returns
//      401 with code:'TOKEN_EXPIRED', call /api/auth/refresh and retry the
//      original request once. The user never sees a logout from token expiry.
//
// Returns the parsed JSON body on success.
// Throws an Error with .status and .body on non-2xx responses.

async function api(path, options = {}) {
  const isFormData = options.body instanceof FormData

  const init = {
    credentials: 'include',
    ...options,
    headers: {
      // For JSON requests we set Content-Type. For FormData, the browser
      // sets multipart/form-data with the right boundary — we must NOT override.
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      ...(options.headers || {}),
    },
  }

  let response = await fetch(path, init)

  // --- Auto-refresh path ---
  // Trigger a refresh on either:
  //   TOKEN_EXPIRED → cookie present, JWT expiry passed
  //   NO_TOKEN      → cookie absent (browser auto-deleted it past maxAge,
  //                   or user closed/reopened tab and access cookie was session-scoped)
  // In both cases the refresh_token cookie likely still lives (7-day lifetime),
  // so /refresh will succeed and rotate us back to a valid pair.
  if (response.status === 401) {
    const errBody = await response.clone().json().catch(() => ({}))

    if (errBody.code === 'TOKEN_EXPIRED' || errBody.code === 'NO_TOKEN') {
      // Try one refresh. On success, retry the original request with the
      // freshly-rotated cookies. On failure, fall through with the original 401.
      const refresh = await fetch('/api/auth/refresh', {
        method: 'POST',
        credentials: 'include',
      })
      if (refresh.ok) {
        response = await fetch(path, init)
      }
    }
  }

  // Parse body once. Some endpoints (e.g., /logout) return 204 with no body;
  // .json() throws on empty body, so guard with .catch.
  const body = await response.json().catch(() => ({}))

  if (!response.ok) {
    const error = new Error(body.error || `HTTP ${response.status}`)
    error.status = response.status
    error.body = body
    throw error
  }

  return body
}

export const apiGet  = (path)         => api(path)
export const apiPost = (path, json)   => api(path, { method: 'POST', body: json ? JSON.stringify(json) : undefined })
export const apiPostForm = (path, fd) => api(path, { method: 'POST', body: fd })

export default api