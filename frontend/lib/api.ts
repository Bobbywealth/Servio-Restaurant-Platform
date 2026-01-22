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
