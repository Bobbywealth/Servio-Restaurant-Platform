import axios from 'axios'

const resolveBaseURL = () => {
  const env =
    process.env.NEXT_PUBLIC_API_URL ||
    process.env.NEXT_PUBLIC_BACKEND_URL ||
    process.env.NEXT_PUBLIC_SERVER_URL; // legacy/alternate name

  if (env) {
    // Ensure URL has protocol
    return env.startsWith('http') ? env : `https://${env}`
  }

  // In production browsers, defaulting to localhost breaks badly; prefer same-origin.
  if (typeof window !== 'undefined') {
    const isLocal =
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1'
    if (!isLocal) return window.location.origin
  }

  return 'http://localhost:3002'
}

const baseURL = resolveBaseURL()

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
