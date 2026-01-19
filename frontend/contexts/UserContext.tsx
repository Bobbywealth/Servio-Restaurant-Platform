import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { api } from '../lib/api'

export interface User {
  id: string
  name: string
  email?: string | null
  role: 'staff' | 'manager' | 'owner'
  permissions: string[]
}

interface UserContextType {
  user: User | null
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  hasPermission: (resource: string, action?: string) => boolean
  updateUser: (updates: Partial<User>) => void
  isManagerOrOwner: boolean
}

const UserContext = createContext<UserContextType | undefined>(undefined)

interface UserProviderProps {
  children: ReactNode
}

export function UserProvider({ children }: UserProviderProps) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const loadUser = async () => {
      try {
        const savedUser = localStorage.getItem('servio_user')
        const accessToken = localStorage.getItem('servio_access_token')
        const refreshToken = localStorage.getItem('servio_refresh_token')

        if (savedUser) {
          setUser(JSON.parse(savedUser))
        }

        if (accessToken) {
          try {
            const meResp = await api.get('/api/auth/me')
            const meUser = meResp.data?.data?.user as User | undefined
            if (meUser) {
              setUser(meUser)
              localStorage.setItem('servio_user', JSON.stringify(meUser))
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
              return
            }
          } catch {
            // fall through to demo login
          }
        }

        // Development convenience: auto-login as demo staff user if nothing is set.
        // This keeps the app functional without building a login UI yet.
        const demoEmail = process.env.NEXT_PUBLIC_DEMO_EMAIL || 'staff@demo.servio'
        const demoPassword = process.env.NEXT_PUBLIC_DEMO_PASSWORD || 'password'
        await login(demoEmail, demoPassword)
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
    try {
      const resp = await api.post('/api/auth/login', { email, password })
      const userData = resp.data?.data?.user as User
      const accessToken = resp.data?.data?.accessToken as string
      const refreshToken = resp.data?.data?.refreshToken as string

      if (accessToken) localStorage.setItem('servio_access_token', accessToken)
      if (refreshToken) localStorage.setItem('servio_refresh_token', refreshToken)
      setUser(userData)
      localStorage.setItem('servio_user', JSON.stringify(userData))
    } finally {
      setIsLoading(false)
    }
  }

  const logout = () => {
    setUser(null)
    localStorage.removeItem('servio_user')
    const refreshToken = localStorage.getItem('servio_refresh_token')
    localStorage.removeItem('servio_access_token')
    localStorage.removeItem('servio_refresh_token')
    if (refreshToken) {
      api.post('/api/auth/logout', { refreshToken }).catch(() => {})
    }
  }

  const hasPermission = (resource: string, action?: string): boolean => {
    if (!user) return false
    const permissions = user.permissions || []
    if (permissions.includes('*')) return true
    if (!action) return permissions.some((p) => p === resource || p.startsWith(`${resource}.`))
    return permissions.includes(`${resource}.${action}`)
  }

  const updateUser = (updates: Partial<User>) => {
    if (user) {
      const updatedUser = { ...user, ...updates }
      setUser(updatedUser)
      localStorage.setItem('servio_user', JSON.stringify(updatedUser))
    }
  }

  const isManagerOrOwner = user?.role === 'manager' || user?.role === 'owner'

  const value: UserContextType = {
    user,
    isLoading,
    login,
    logout,
    hasPermission,
    updateUser,
    isManagerOrOwner
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