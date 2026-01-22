import axios from 'axios'

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
  timeout: 60_000,
  headers: {
    'Content-Type': 'application/json'
  }
})

let refreshInFlight: Promise<string | null> | null = null

api.interceptors.request.use((config) => {
  if (typeof window === 'undefined') return config
  // Try both common token keys
  const token = localStorage.getItem('servio_access_token')
  if (token) {
    config.headers = config.headers ?? {}
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error?.response?.status
    const message = error?.response?.data?.error?.message || error?.message
    const originalConfig = error?.config as any

    if (typeof window === 'undefined') {
      return Promise.reject(error)
    }

    if (status === 401 && !originalConfig?._retry) {
      originalConfig._retry = true
      const refreshToken = localStorage.getItem('servio_refresh_token')
      if (!refreshToken) {
        localStorage.removeItem('servio_access_token')
        localStorage.removeItem('servio_refresh_token')
        localStorage.removeItem('servio_user')
        window.location.href = '/login'
        return Promise.reject(error)
      }

      if (!refreshInFlight) {
        refreshInFlight = refreshClient
          .post('/api/auth/refresh', { refreshToken })
          .then((resp) => {
            const newAccessToken = resp?.data?.data?.accessToken as string | undefined
            if (!newAccessToken) return null
            localStorage.setItem('servio_access_token', newAccessToken)
            if (process.env.NODE_ENV !== 'production') {
              console.info('[api] refreshed access token')
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
        originalConfig.headers = originalConfig.headers ?? {}
        originalConfig.headers.Authorization = `Bearer ${newToken}`
        return api.request(originalConfig)
      }

      localStorage.removeItem('servio_access_token')
      localStorage.removeItem('servio_refresh_token')
      localStorage.removeItem('servio_user')
      if (process.env.NODE_ENV !== 'production') {
        console.info('[api] refresh failed, redirecting to login', message)
      }
      window.location.href = '/login'
    }

    return Promise.reject(error)
  }
)
