import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react'

export interface User {
  id: string
  name: string
  email: string
  role: 'admin' | 'manager' | 'server' | 'kitchen' | 'host'
  permissions: Permission[]
  shift: {
    isActive: boolean
    startTime?: Date
    endTime?: Date
  }
  restaurant: {
    id: string
    name: string
  }
}

export interface Permission {
  resource: string
  actions: string[]
}

interface UserContextType {
  user: User | null
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  hasPermission: (resource: string, action?: string) => boolean
  updateUser: (updates: Partial<User>) => void
}

const UserContext = createContext<UserContextType | undefined>(undefined)

interface UserProviderProps {
  children: ReactNode
}

export function UserProvider({ children }: UserProviderProps) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Simulate loading user data from localStorage or API
    const loadUser = async () => {
      try {
        const savedUser = localStorage.getItem('servio_user')
        if (savedUser) {
          const userData = JSON.parse(savedUser)
          setUser(userData)
        } else {
          // For demo purposes, create a default user
          const demoUser: User = {
            id: 'demo-user-1',
            name: 'Alex Johnson',
            email: 'alex@restaurant.com',
            role: 'server',
            permissions: [
              { resource: 'orders', actions: ['read', 'create', 'update'] },
              { resource: 'inventory', actions: ['read'] },
              { resource: 'assistant', actions: ['use', 'voice_commands'] },
              { resource: 'pos', actions: ['read', 'create'] }
            ],
            shift: {
              isActive: true,
              startTime: new Date()
            },
            restaurant: {
              id: 'restaurant-1',
              name: 'The Golden Fork'
            }
          }
          setUser(demoUser)
          localStorage.setItem('servio_user', JSON.stringify(demoUser))
        }
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
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      const userData: User = {
        id: 'user-' + Date.now(),
        name: email.split('@')[0],
        email,
        role: 'server',
        permissions: [
          { resource: 'orders', actions: ['read', 'create', 'update'] },
          { resource: 'inventory', actions: ['read'] },
          { resource: 'assistant', actions: ['use', 'voice_commands'] },
          { resource: 'pos', actions: ['read', 'create'] }
        ],
        shift: {
          isActive: true,
          startTime: new Date()
        },
        restaurant: {
          id: 'restaurant-1',
          name: 'The Golden Fork'
        }
      }

      setUser(userData)
      localStorage.setItem('servio_user', JSON.stringify(userData))
    } finally {
      setIsLoading(false)
    }
  }

  const logout = () => {
    setUser(null)
    localStorage.removeItem('servio_user')
  }

  const hasPermission = (resource: string, action?: string): boolean => {
    if (!user) return false

    const permission = user.permissions.find(p => p.resource === resource)
    if (!permission) return false

    if (!action) return true
    return permission.actions.includes(action)
  }

  const updateUser = (updates: Partial<User>) => {
    if (user) {
      const updatedUser = { ...user, ...updates }
      setUser(updatedUser)
      localStorage.setItem('servio_user', JSON.stringify(updatedUser))
    }
  }

  const value: UserContextType = {
    user,
    isLoading,
    login,
    logout,
    hasPermission,
    updateUser
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