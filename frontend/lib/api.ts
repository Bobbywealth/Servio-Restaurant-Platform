import axios from 'axios'
import { safeLocalStorage as SLS } from './utils'

const BACKEND_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  'http://localhost:3002'

if (process.env.NODE_ENV === 'production' && !process.env.NEXT_PUBLIC_API_URL && !process.env.NEXT_PUBLIC_BACKEND_URL) {
  throw new Error('NEXT_PUBLIC_API_URL is required in production builds.')
}

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

const refreshClient = axios.create({
  baseURL,
  timeout: 30_000, // Shorter timeout for refresh
  headers: {
    'Content-Type': 'application/json'
  }
})

let refreshInFlight: Promise<string | null> | null = null
let lastRefreshTime = 0
const MIN_REFRESH_INTERVAL = 30_000 // Don't refresh more than once per 30 seconds

// Check if token is about to expire (within 2 minutes)
function isTokenExpiringSoon(token: string): boolean {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return true

    const payload = JSON.parse(atob(parts[1]))
    if (!payload.exp) return false

    const expiresAt = payload.exp * 1000
    const now = Date.now()
    const twoMinutes = 2 * 60 * 1000

    return expiresAt - now < twoMinutes
  } catch {
    return false
  }
}

// Proactive token refresh
async function proactiveRefresh(): Promise<string | null> {
  if (typeof window === 'undefined') return null

  const now = Date.now()
  if (now - lastRefreshTime < MIN_REFRESH_INTERVAL) {
    return SLS.getItem('servio_access_token')
  }

  const refreshToken = SLS.getItem('servio_refresh_token')
  if (!refreshToken) return null

  if (!refreshInFlight) {
    refreshInFlight = refreshClient
      .post('/api/auth/refresh', { refreshToken })
      .then((resp) => {
        const newAccessToken = resp?.data?.data?.accessToken as string | undefined
        if (!newAccessToken) return null
        SLS.setItem('servio_access_token', newAccessToken)
        lastRefreshTime = Date.now()
        if (process.env.NODE_ENV !== 'production') {
          console.info('[api] proactively refreshed access token')
        }
        return newAccessToken
      })
      .catch(() => null)
      .finally(() => {
        refreshInFlight = null
      })
  }

  return refreshInFlight
}

api.interceptors.request.use(async (config) => {
  if (typeof window === 'undefined') return config

  let token = SLS.getItem('servio_access_token')

  // Check if token exists and is expiring soon
  if (token && isTokenExpiringSoon(token)) {
    // Proactively refresh before request
    const newToken = await proactiveRefresh()
    if (newToken) {
      token = newToken
    }
  }

  if (token) {
    config.headers = config.headers ?? {}
    config.headers.Authorization = `Bearer ${token}`
    return config
  }

  const refreshToken = SLS.getItem('servio_refresh_token')
  if (!refreshToken) return config

  if (!refreshInFlight) {
    refreshInFlight = refreshClient
      .post('/api/auth/refresh', { refreshToken })
      .then((resp) => {
        const newAccessToken = resp?.data?.data?.accessToken as string | undefined
        if (!newAccessToken) return null
        SLS.setItem('servio_access_token', newAccessToken)
        lastRefreshTime = Date.now()
        if (process.env.NODE_ENV !== 'production') {
          console.info('[api] refreshed access token (request)')
        }
        return newAccessToken
      })
      .catch(() => null)
      .finally(() => {
        refreshInFlight = null
      })
  }

  const newToken = await refreshInFlight
  if (newToken) {
    config.headers = config.headers ?? {}
    config.headers.Authorization = `Bearer ${newToken}`
  }

  return config
})

// Determine the correct login page based on current URL
function getLoginUrl(): string {
  if (typeof window === 'undefined') return '/login'
  const path = window.location.pathname
  if (path.startsWith('/tablet')) {
    const next = encodeURIComponent(path)
    return `/tablet/login?next=${next}`
  }
  return '/login'
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error?.response?.status
    const message = error?.response?.data?.error?.message || error?.message
    const originalConfig = error?.config as any

    if (typeof window === 'undefined') {
      return Promise.reject(error)
    }

    // Handle 401 with retry logic
    if (status === 401 && !originalConfig?._retry) {
      originalConfig._retry = true
      const refreshToken = SLS.getItem('servio_refresh_token')

      if (!refreshToken) {
        // No refresh token available - must logout
        SLS.removeItem('servio_access_token')
        SLS.removeItem('servio_refresh_token')
        SLS.removeItem('servio_user')
        window.location.href = getLoginUrl()
        return Promise.reject(error)
      }

      if (!refreshInFlight) {
        let refreshSuccess = false
        refreshInFlight = refreshClient
          .post('/api/auth/refresh', { refreshToken })
          .then((resp) => {
            const newAccessToken = resp?.data?.data?.accessToken as string | undefined
            if (!newAccessToken) return null
            SLS.setItem('servio_access_token', newAccessToken)
            lastRefreshTime = Date.now()
            refreshSuccess = true
            if (process.env.NODE_ENV !== 'production') {
              console.info('[api] refreshed access token')
            }
            return newAccessToken
          })
          .catch((refreshError) => {
            // Refresh failed - must logout
            if (process.env.NODE_ENV !== 'production') {
              console.error('[api] token refresh failed, logging out', refreshError)
            }
            return null
          })
          .finally(() => {
            refreshInFlight = null
          })

        const newToken = await refreshInFlight

        if (newToken) {
          // Refresh succeeded - retry the original request with new token
          originalConfig.headers = originalConfig.headers ?? {}
          originalConfig.headers.Authorization = `Bearer ${newToken}`
          return api.request(originalConfig)
        }

        // Refresh failed - logout
        SLS.removeItem('servio_access_token')
        SLS.removeItem('servio_refresh_token')
        SLS.removeItem('servio_user')
        if (process.env.NODE_ENV !== 'production') {
          console.warn('[api] refresh failed, redirecting to login')
        }
        window.location.href = getLoginUrl()
      }

      return Promise.reject(error)
    }

    return Promise.reject(error)
  }
)

// Export helper for manual token refresh (used by keep-alive)
export async function refreshAccessToken(): Promise<boolean> {
  const newToken = await proactiveRefresh()
  return !!newToken
}

// Check if localStorage is available
function isLocalStorageAvailable(): boolean {
  try {
    if (typeof window === 'undefined') return false
    const test = '__storage_test__'
    localStorage.setItem(test, test)
    localStorage.removeItem(test)
    return true
  } catch {
    return false
  }
}

// Safe localStorage operations with error handling
const safeLocalStorage = {
  getItem: (key: string): string | null => {
    try {
      if (!isLocalStorageAvailable()) return null
      return localStorage.getItem(key)
    } catch {
      return null
    }
  },
  setItem: (key: string, value: string): void => {
    try {
      if (!isLocalStorageAvailable()) return
      localStorage.setItem(key, value)
    } catch (error) {
      if (error instanceof Error && error.name === 'QuotaExceededError') {
        console.warn('[api] localStorage quota exceeded')
      }
    }
  },
  removeItem: (key: string): void => {
    try {
      if (!isLocalStorageAvailable()) return
      localStorage.removeItem(key)
    } catch {
      // Ignore errors
    }
  }
}
