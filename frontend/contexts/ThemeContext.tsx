import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { safeLocalStorage } from '../lib/utils'

type Theme = 'light' | 'dark' | 'system'

interface ThemeContextType {
  theme: Theme
  actualTheme: 'light' | 'dark'
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

interface ThemeProviderProps {
  children: ReactNode
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  // Light theme is always the default
  const [theme, setThemeState] = useState<Theme>('light')
  const [actualTheme, setActualTheme] = useState<'light' | 'dark'>('light')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    // Always default to light theme - don't load from localStorage
    // Light theme should be the default at all times
    setThemeState('light')
    setActualTheme('light')
  }, [])

  useEffect(() => {
    if (!mounted || typeof window === 'undefined') return
    
    const root = window.document.documentElement

    // Remove previous theme classes
    root.classList.remove('light', 'dark')

    let effectiveTheme: 'light' | 'dark'

    if (theme === 'system') {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
      effectiveTheme = systemTheme
    } else {
      effectiveTheme = theme
    }

    setActualTheme(effectiveTheme)
    root.classList.add(effectiveTheme)

    // Only save to localStorage if user explicitly changes theme
    // Default is always light, so we don't save 'light' to localStorage
    if (theme !== 'light') {
      safeLocalStorage.setItem('servio_theme', theme)
    } else {
      safeLocalStorage.removeItem('servio_theme')
    }
  }, [theme, mounted])

  // Listen for system theme changes
  useEffect(() => {
    if (!mounted || theme !== 'system' || typeof window === 'undefined') return

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')

    const handleChange = () => {
      const systemTheme = mediaQuery.matches ? 'dark' : 'light'
      setActualTheme(systemTheme)

      const root = window.document.documentElement
      root.classList.remove('light', 'dark')
      root.classList.add(systemTheme)
    }

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', handleChange)
      return () => mediaQuery.removeEventListener('change', handleChange)
    }

    mediaQuery.addListener?.(handleChange)
    return () => mediaQuery.removeListener?.(handleChange)
  }, [theme, mounted])

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme)
  }

  const toggleTheme = () => {
    if (theme === 'system') {
      setTheme('dark')
    } else if (theme === 'light') {
      setTheme('dark')
    } else {
      setTheme('light')
    }
  }

  const value: ThemeContextType = {
    theme,
    actualTheme,
    setTheme,
    toggleTheme
  }

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}
