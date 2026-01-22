import axios from 'axios'

const BACKEND_URL =
  process.env.NEXT_PUBLIC_API_URL || 
  process.env.NEXT_PUBLIC_BACKEND_URL || 
  'http://localhost:3002'

// Ensure URL has protocol
const baseURL = BACKEND_URL.startsWith('http') 
  ? BACKEND_URL 
  : `https://${BACKEND_URL}`

export const api = axios.create({
  baseURL,
  timeout: 60_000,
  headers: {
    'Content-Type': 'application/json'
  }
})

api.interceptors.request.use((config) => {
  if (typeof window === 'undefined') return config
  // Try both common token keys
  const token = localStorage.getItem('servio_access_token') || localStorage.getItem('accessToken')
  if (token) {
    config.headers = config.headers ?? {}
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

let refreshPromise: Promise<string | null> | null = null

async function refreshAccessToken(): Promise<string | null> {
  if (typeof window === 'undefined') return null
  const refreshToken = window.localStorage.getItem('servio_refresh_token')
  if (!refreshToken) return null

  // Ensure only one refresh runs at a time.
  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        const resp = await api.post('/api/auth/refresh', { refreshToken }, { headers: { Authorization: '' } })
        const newAccessToken = resp.data?.data?.accessToken as string | undefined
        const user = resp.data?.data?.user as any | undefined
        if (newAccessToken) window.localStorage.setItem('servio_access_token', newAccessToken)
        if (user) window.localStorage.setItem('servio_user', JSON.stringify(user))
        return newAccessToken || null
      } catch {
        return null
      } finally {
        refreshPromise = null
      }
    })()
  }

  return refreshPromise
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error?.response?.status
    const original = error?.config as any

    // Only handle 401s from real requests (and avoid infinite loops).
    if (status !== 401 || !original || original.__isRetryRequest) {
      return Promise.reject(error)
    }

    // Don't try to refresh if the 401 was from refresh itself.
    const url = String(original.url || '')
    if (url.includes('/api/auth/refresh') || url.includes('/api/auth/login')) {
      return Promise.reject(error)
    }

    const newToken = await refreshAccessToken()
    if (!newToken) {
      // Hard logout: must sign in again.
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem('servio_user')
        window.localStorage.removeItem('servio_access_token')
        window.localStorage.removeItem('servio_refresh_token')
        try {
          window.location.href = '/login'
        } catch {
          // ignore
        }
      }
      return Promise.reject(error)
    }

    original.__isRetryRequest = true
    original.headers = original.headers ?? {}
    original.headers.Authorization = `Bearer ${newToken}`
    return api.request(original)
  }
)
