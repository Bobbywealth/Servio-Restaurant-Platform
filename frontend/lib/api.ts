import axios from 'axios'
import { safeLocalStorage as SLS } from './utils'

const BACKEND_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.NEXT_PUBLIC_BACKEND_URL

if (!BACKEND_URL) {
  throw new Error('NEXT_PUBLIC_API_URL or NEXT_PUBLIC_BACKEND_URL environment variable is required')
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

// Cache for token expiry to avoid parsing JWT on every request
let cachedTokenExpiry: { token: string; expiresAt: number } | null = null

// Check if token is about to expire (within 2 minutes)
function isTokenExpiringSoon(token: string): boolean {
  try {
    // Use cached expiry if token hasn't changed
    if (cachedTokenExpiry && cachedTokenExpiry.token === token) {
      const now = Date.now()
      const twoMinutes = 2 * 60 * 1000
      return cachedTokenExpiry.expiresAt - now < twoMinutes
    }

    const parts = token.split('.')
    if (parts.length !== 3) return true

    const payload = JSON.parse(atob(parts[1]))
    if (!payload.exp) return false

    const expiresAt = payload.exp * 1000

    // Cache the parsed expiry
    cachedTokenExpiry = { token, expiresAt }

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
        // Sync new token to service worker for PWA support
        syncTokenToServiceWorker(newAccessToken)
        // Clear cached expiry so it gets recalculated with new token
        cachedTokenExpiry = null
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

  // Check network status
  if (!isOnline()) {
    console.warn('[api] Network is offline, skipping token refresh')
    return config
  }

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
        // Sync new token to service worker for PWA support
        syncTokenToServiceWorker(newAccessToken)
        cachedTokenExpiry = null
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
      if (process.env.NODE_ENV === 'production') {
        console.error('[api] Received 401 - clearing auth tokens')
      }
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
            // Sync new token to service worker for PWA support
            syncTokenToServiceWorker(newAccessToken)
            cachedTokenExpiry = null
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
        console.warn('[api] localStorage quota exceeded for key:', key)
      } else {
        console.warn('[api] Failed to set localStorage key:', key, error)
      }
    }
  },
  removeItem: (key: string): void => {
    try {
      if (!isLocalStorageAvailable()) return
      localStorage.removeItem(key)
    } catch {
      // Silent fail - localStorage is unreliable in some browsers
    }
  }
}

// Network detection helper
function isOnline(): boolean {
  if (typeof navigator === 'undefined') return true
  return navigator.onLine !== undefined ? navigator.onLine : true
}

// Sync auth token to service worker for offline/PWA support
export function syncTokenToServiceWorker(token: string | null): void {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return

  navigator.serviceWorker.ready.then((registration) => {
    if (registration.active) {
      if (token) {
        registration.active.postMessage({
          type: 'SET_AUTH_TOKEN',
          payload: { token }
        })
      } else {
        registration.active.postMessage({
          type: 'CLEAR_AUTH_TOKEN'
        })
      }
    }
  }).catch(() => {
    // Service worker not available
  })
}

// Clear cached token expiry when token changes
export function clearTokenCache(): void {
  cachedTokenExpiry = null
}
