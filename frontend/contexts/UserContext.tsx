import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { api } from '../lib/api'

export interface User {
  id: string
  restaurantId?: string
  name: string
  email?: string | null
  role: 'staff' | 'manager' | 'owner' | 'admin' | 'platform-admin'
  permissions: string[]
}

interface AccountOption {
  id: string
  email: string
  name: string
  role: 'staff' | 'manager' | 'owner' | 'admin' | 'platform-admin'
}

interface UserContextType {
  user: User | null
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  signup: (name: string, email: string, password: string, restaurantName: string) => Promise<void>
  logout: () => void
  hasPermission: (resource: string, action?: string) => boolean
  updateUser: (updates: Partial<User>) => void
  isManagerOrOwner: boolean
  // Account switching functionality
  availableAccounts: Record<string, AccountOption[]>
  loadAvailableAccounts: () => Promise<void>
  switchAccount: (targetEmail: string) => Promise<void>
  isAdmin: boolean
}

const UserContext = createContext<UserContextType | undefined>(undefined)

interface UserProviderProps {
  children: ReactNode
}

export function UserProvider({ children }: UserProviderProps) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [mounted, setMounted] = useState(false)
  const [availableAccounts, setAvailableAccounts] = useState<Record<string, AccountOption[]>>({})
  
  const clearAuthStorage = () => {
    if (typeof window === 'undefined') return
    localStorage.removeItem('servio_user')
    localStorage.removeItem('servio_access_token')
    localStorage.removeItem('servio_refresh_token')
  }

  useEffect(() => {
    setMounted(true)
    const loadUser = async () => {
      try {
        if (typeof window === 'undefined') {
          setIsLoading(false)
          return
        }
        
        const savedUser = localStorage.getItem('servio_user')
        const accessToken = localStorage.getItem('servio_access_token')
        const refreshToken = localStorage.getItem('servio_refresh_token')

        if (savedUser && accessToken) {
          setUser(JSON.parse(savedUser))
        } else if (savedUser && !accessToken && !refreshToken) {
          setUser(null)
          clearAuthStorage()
        }

        if (accessToken) {
          try {
            const meResp = await api.get('/api/auth/me')
            const meUser = meResp.data?.data?.user as User | undefined
            if (meUser) {
              setUser(meUser)
              localStorage.setItem('servio_user', JSON.stringify(meUser))
              // Load available accounts for switching
              loadAvailableAccounts().catch(console.error)
              return
            }
          } catch {
            // try refresh below
          }
        }

        if (refreshToken) {
          try {
            const refreshResp = await api.post('/api/auth/refresh', { refreshToken })
            const newAccessToken = refreshResp.data?.data?.accessToken as string | undefined
            const refreshedUser = refreshResp.data?.data?.user as User | undefined
            if (newAccessToken) localStorage.setItem('servio_access_token', newAccessToken)
            if (refreshedUser) {
              setUser(refreshedUser)
              localStorage.setItem('servio_user', JSON.stringify(refreshedUser))
              // Load available accounts for switching
              loadAvailableAccounts().catch(console.error)
              return
            }
          } catch {
            // fall through to clear auth
          }
        }

        setUser(null)
        clearAuthStorage()

        // Development convenience: auto-login disabled for testing
        // const demoEmail = process.env.NEXT_PUBLIC_DEMO_EMAIL || 'admin@servio.com'
        // const demoPassword = process.env.NEXT_PUBLIC_DEMO_PASSWORD || 'password'
        // await login(demoEmail, demoPassword)
      } catch (error) {
        console.error('Failed to load user:', error)
      } finally {
        setIsLoading(false)
      }
    }

    loadUser()
  }, [])

  const login = async (email: string, password: string) => {
    setIsLoading(true)
    
    // Clear any existing stale tokens before login
    clearAuthStorage()
    
    try {
      const normalizedEmail = email.trim().toLowerCase()
      const resp = await api.post('/api/auth/login', { email: normalizedEmail, password })
      const userData = resp.data?.data?.user as User
      const accessToken = resp.data?.data?.accessToken as string
      const refreshToken = resp.data?.data?.refreshToken as string

      if (typeof window !== 'undefined') {
        if (accessToken) localStorage.setItem('servio_access_token', accessToken)
        if (refreshToken) localStorage.setItem('servio_refresh_token', refreshToken)
        localStorage.setItem('servio_user', JSON.stringify(userData))
      }
      setUser(userData)
      
      // Load available accounts for switching
      loadAvailableAccounts().catch(console.error)
    } finally {
      setIsLoading(false)
    }
  }

  const signup = async (name: string, email: string, password: string, restaurantName: string) => {
    setIsLoading(true)
    
    // Clear any existing stale tokens before signup
    clearAuthStorage()
    
    try {
      const normalizedEmail = email.trim().toLowerCase()
      await api.post('/api/auth/signup', { 
        name: name.trim(), 
        email: normalizedEmail, 
        password, 
        restaurantName: restaurantName.trim() 
      })
      
      // After successful signup, automatically log in the user
      await login(normalizedEmail, password)
      
      // Mark as new user for tour
      if (typeof window !== 'undefined') {
        localStorage.setItem('servio_new_signup', 'true')
      }
    } finally {
      setIsLoading(false)
    }
  }

  const logout = () => {
    setUser(null)
    if (typeof window !== 'undefined') {
      localStorage.removeItem('servio_user')
      const refreshToken = localStorage.getItem('servio_refresh_token')
      localStorage.removeItem('servio_access_token')
      localStorage.removeItem('servio_refresh_token')
      if (refreshToken) {
        api.post('/api/auth/logout', { refreshToken }).catch(() => {})
      }
    }
  }

  const hasPermission = (resource: string, action?: string): boolean => {
    if (!user) return false
    const permissions = user.permissions || []
    if (permissions.includes('*')) return true
    // Support both backend-style "resource:action" and legacy frontend-style "resource.action"
    // Also support wildcard prefixes like "orders.*" or "orders:*"
    const normalize = (p: string) => String(p || '').trim()
    const perms = permissions.map(normalize)

    if (!action) {
      // If caller passes a full permission string like "orders:read"
      if (resource.includes(':') || resource.includes('.')) {
        const direct = normalize(resource)
        const [resKey] = direct.split(/[:.]/)
        return (
          perms.includes(direct) ||
          perms.includes(`${resKey}.*`) ||
          perms.includes(`${resKey}:*`)
        )
      }

      // If caller passes just "orders"
      return perms.some((p) => p === resource || p.startsWith(`${resource}.`) || p.startsWith(`${resource}:`))
    }

    const dot = `${resource}.${action}`
    const colon = `${resource}:${action}`
    return (
      perms.includes(dot) ||
      perms.includes(colon) ||
      perms.includes(`${resource}.*`) ||
      perms.includes(`${resource}:*`)
    )
  }

  const updateUser = (updates: Partial<User>) => {
    if (user) {
      const updatedUser = { ...user, ...updates }
      setUser(updatedUser)
      if (typeof window !== 'undefined') {
        localStorage.setItem('servio_user', JSON.stringify(updatedUser))
      }
    }
  }

  const loadAvailableAccounts = async () => {
    try {
      const response = await api.get('/api/auth/available-accounts')
      const accounts = response.data?.data?.accounts || {}
      setAvailableAccounts(accounts)
    } catch (error) {
      console.error('Failed to load available accounts:', error)
      setAvailableAccounts({})
    }
  }

  const switchAccount = async (targetEmail: string) => {
    setIsLoading(true)
    try {
      const response = await api.post('/api/auth/switch-account', { targetEmail })
      const userData = response.data?.data?.user as User
      const accessToken = response.data?.data?.accessToken as string
      const refreshToken = response.data?.data?.refreshToken as string

      if (typeof window !== 'undefined') {
        if (accessToken) localStorage.setItem('servio_access_token', accessToken)
        if (refreshToken) localStorage.setItem('servio_refresh_token', refreshToken)
        localStorage.setItem('servio_user', JSON.stringify(userData))
      }
      setUser(userData)

      // Reload available accounts after switching
      await loadAvailableAccounts()
    } catch (error) {
      console.error('Failed to switch account:', error)
      throw error
    } finally {
      setIsLoading(false)
    }
  }

  const isManagerOrOwner = user?.role === 'manager' || user?.role === 'owner'
  const isAdmin = user?.role === 'admin'

  const value: UserContextType = {
    user,
    isLoading,
    login,
    signup,
    logout,
    hasPermission,
    updateUser,
    isManagerOrOwner,
    availableAccounts,
    loadAvailableAccounts,
    switchAccount,
    isAdmin
  }

  return (
    <UserContext.Provider value={value}>
      {children}
    </UserContext.Provider>
  )
}

export function useUser() {
  const context = useContext(UserContext)
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider')
  }
  return context
}