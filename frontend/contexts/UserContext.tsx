import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { api } from '../lib/api'
import { safeLocalStorage } from '../lib/utils'

export interface User {
  id: string
  restaurantId?: string
  name: string
  email?: string | null
  role: 'staff' | 'manager' | 'owner' | 'admin'
  permissions: string[]
}

interface AccountOption {
  id: string
  email: string
  name: string
  role: 'staff' | 'manager' | 'owner' | 'admin'
}

interface UserContextType {
  user: User | null
  isLoading: boolean
  login: (email: string, password: string, stayLoggedIn?: boolean) => Promise<void>
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
    try {
      safeLocalStorage.removeItem('servio_user')
      safeLocalStorage.removeItem('servio_access_token')
      safeLocalStorage.removeItem('servio_refresh_token')
    } catch (error) {
      console.warn('[auth] Failed to clear auth storage:', error)
    }
  }

  useEffect(() => {
    setMounted(true)
    let isMounted = true
    let watchdog: ReturnType<typeof setTimeout> | null = null
    const startedAt = Date.now()
    const log = (...args: any[]) => {
      // eslint-disable-next-line no-console
      console.info('[auth-init]', ...args)
    }

    // Handle online/offline events
    const handleOnline = () => {
      console.log('[auth] Network back online')
      // Reload user when we come back online
      loadUser().catch(err => console.error('[auth] Failed to reload user:', err))
    }

    const handleOffline = () => {
      console.warn('[auth] Network went offline')
    }

    const loadUser = async () => {
      try {
        if (typeof window === 'undefined') {
          if (isMounted) setIsLoading(false)
          return
        }

        if (!isMounted) return

        const savedUser = safeLocalStorage.getItem('servio_user')
        const accessToken = safeLocalStorage.getItem('servio_access_token')
        const refreshToken = safeLocalStorage.getItem('servio_refresh_token')

        log('begin', {
          hasSavedUser: Boolean(savedUser),
          hasAccessToken: Boolean(accessToken),
          hasRefreshToken: Boolean(refreshToken)
        })

        let userSet = false

        // Try to use existing access token first
        if (savedUser && accessToken) {
          if (!isMounted) return
          setUser(JSON.parse(savedUser))
          userSet = true
          log('hydrated user from localStorage')
        } else if (savedUser && !accessToken && !refreshToken) {
          if (!isMounted) return
          setUser(null)
          clearAuthStorage()
          log('cleared stale saved user (no tokens)')
        }

        // Validate with /api/auth/me if we have an access token
        if (accessToken && !userSet) {
          try {
            log('calling /api/auth/me')
            const meResp = await api.get('/api/auth/me', { timeout: 15_000 })
            const meUser = meResp.data?.data?.user as User | undefined
            if (meUser && isMounted) {
              setUser(meUser)
              safeLocalStorage.setItem('servio_user', JSON.stringify(meUser))
              loadAvailableAccounts().catch(console.error)
              userSet = true
              log('/api/auth/me success', { userId: meUser.id, restaurantId: meUser.restaurantId, role: meUser.role })
            } else {
              log('/api/auth/me returned no user payload')
            }
          } catch (error: any) {
            const status = error?.response?.status

            // Only clear auth on 401 Unauthorized
            if (status === 401) {
              log('/api/auth/me got 401 - token expired')
              safeLocalStorage.removeItem('servio_access_token')
            } else {
              // Other errors (network, 500, etc.) - don't logout
              log('/api/auth/me failed (non-fatal)', {
                message: error?.message,
                status: status
              })
            }
          }
        }

        // Try to refresh if we have a refresh token and haven't set user yet
        if (refreshToken && !userSet && isMounted) {
          try {
            log('calling /api/auth/refresh')
            const refreshResp = await api.post('/api/auth/refresh', { refreshToken }, { timeout: 15_000 })
            const newAccessToken = refreshResp.data?.data?.accessToken as string | undefined
            const refreshedUser = refreshResp.data?.data?.user as User | undefined
            if (newAccessToken) {
              safeLocalStorage.setItem('servio_access_token', newAccessToken)
            }
            if (refreshedUser) {
              setUser(refreshedUser)
              safeLocalStorage.setItem('servio_user', JSON.stringify(refreshedUser))
              loadAvailableAccounts().catch(console.error)
              userSet = true
              log('/api/auth/refresh success', {
                hasNewAccessToken: Boolean(newAccessToken),
                userId: refreshedUser.id,
                restaurantId: refreshedUser.restaurantId,
                role: refreshedUser.role
              })
            } else {
              log('/api/auth/refresh returned no user payload', { hasNewAccessToken: Boolean(newAccessToken) })
            }
          } catch (error: any) {
            const status = error?.response?.status

            // Only clear auth on 401 Invalid refresh token
            if (status === 401) {
              log('/api/auth/refresh got 401 - refresh token expired')
              clearAuthStorage()
            } else {
              // Other errors - don't logout, user might still have a valid session
              log('/api/auth/refresh failed (non-fatal)', {
                message: error?.message,
                status: status
              })
            }
          }
        }

        // Only logout if we have no user set and no way to get one
        if (!userSet && isMounted) {
          log('no valid session available (user not set)')
        }
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('[auth-init] failed to load user:', error)
      } finally {
        if (isMounted) {
          setIsLoading(false)
          log('done', { ms: Date.now() - startedAt })
        }
        if (watchdog) clearTimeout(watchdog)
      }
    }

    loadUser()

    // Add online/offline listeners
    if (typeof window !== 'undefined' && 'addEventListener' in window) {
      window.addEventListener('online', handleOnline)
      window.addEventListener('offline', handleOffline)
    }

    return () => {
      isMounted = false
      if (watchdog) clearTimeout(watchdog)
      if (typeof window !== 'undefined' && 'removeEventListener' in window) {
        window.removeEventListener('online', handleOnline)
        window.removeEventListener('offline', handleOffline)
      }
    }
  }, [])

  const login = async (email: string, password: string, stayLoggedIn: boolean = false) => {
    setIsLoading(true)
    
    // Clear any existing stale tokens before login
    clearAuthStorage()
    
    try {
      const normalizedEmail = email.trim().toLowerCase()
      const resp = await api.post('/api/auth/login', { email: normalizedEmail, password, stayLoggedIn })
      const userData = resp.data?.data?.user as User
      const accessToken = resp.data?.data?.accessToken as string
      const refreshToken = resp.data?.data?.refreshToken as string

      if (typeof window !== 'undefined') {
        if (accessToken) safeLocalStorage.setItem('servio_access_token', accessToken)
        if (refreshToken) safeLocalStorage.setItem('servio_refresh_token', refreshToken)
        safeLocalStorage.setItem('servio_user', JSON.stringify(userData))
      }
      setUser(userData)
      
      // Load available accounts for switching
      loadAvailableAccounts().catch(console.error)
    } finally {
      setIsLoading(false)
    }
  }

  const logout = () => {
    if (process.env.NODE_ENV === 'production') {
      console.log('[auth] Logging out:', { user, hasTokens: {
        accessToken: Boolean(safeLocalStorage.getItem('servio_access_token')),
        refreshToken: Boolean(safeLocalStorage.getItem('servio_refresh_token'))
      }})
    }
    setUser(null)
    if (typeof window !== 'undefined') {
      safeLocalStorage.removeItem('servio_user')
      const refreshToken = safeLocalStorage.getItem('servio_refresh_token')
      safeLocalStorage.removeItem('servio_access_token')
      safeLocalStorage.removeItem('servio_refresh_token')
      if (refreshToken) {
        api.post('/api/auth/logout', { refreshToken }).catch(() => {})
      }
    }
  }

  const hasPermission = (resource: string, action?: string): boolean => {
    if (!user) return false
    const permissions = user.permissions || []
    if (permissions.includes('*')) return true
    // Support backend-style "resource:action" and legacy frontend-style "resource.action"
    // Also support wildcard prefixes like "orders.*" and "orders:*"
    const normalize = (p: string) => String(p || '').trim()
    const perms = permissions.map(normalize)

    if (!action) {
      if (resource.includes(':') || resource.includes('.')) {
        const direct = normalize(resource)
        const [resKey] = direct.split(/[:.]/)
        return perms.includes(direct) || perms.includes(`${resKey}.*`) || perms.includes(`${resKey}:*`)
      }

      return perms.some((p) => p === resource || p.startsWith(`${resource}.`) || p.startsWith(`${resource}:`))
    }

    const dot = `${resource}.${action}`
    const colon = `${resource}:${action}`
    return perms.includes(dot) || perms.includes(colon) || perms.includes(`${resource}.*`) || perms.includes(`${resource}:*`)
  }

  const updateUser = (updates: Partial<User>) => {
    if (user) {
      const updatedUser = { ...user, ...updates }
      setUser(updatedUser)
      if (typeof window !== 'undefined') {
        safeLocalStorage.setItem('servio_user', JSON.stringify(updatedUser))
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
        if (accessToken) safeLocalStorage.setItem('servio_access_token', accessToken)
        if (refreshToken) safeLocalStorage.setItem('servio_refresh_token', refreshToken)
        safeLocalStorage.setItem('servio_user', JSON.stringify(userData))
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
