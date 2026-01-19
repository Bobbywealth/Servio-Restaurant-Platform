import React from 'react'
import { motion } from 'framer-motion'
import { Sun, Moon, Monitor } from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'

interface ThemeToggleProps {
  showLabel?: boolean
  variant?: 'button' | 'dropdown'
}

export default function ThemeToggle({ showLabel = false, variant = 'button' }: ThemeToggleProps) {
  const { theme, actualTheme, setTheme } = useTheme()

  const themes = [
    { value: 'light', icon: Sun, label: 'Light' },
    { value: 'dark', icon: Moon, label: 'Dark' },
    { value: 'system', icon: Monitor, label: 'System' },
  ] as const

  if (variant === 'dropdown') {
    return (
      <div className="relative">
        <select
          value={theme}
          onChange={(e) => setTheme(e.target.value as any)}
          className="input-field pr-8 appearance-none bg-surface-100 dark:bg-surface-800"
        >
          {themes.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </div>
    )
  }

  const currentTheme = themes.find(t => t.value === theme)
  const CurrentIcon = currentTheme?.icon || Sun

  return (
    <motion.button
      onClick={() => {
        const currentIndex = themes.findIndex(t => t.value === theme)
        const nextIndex = (currentIndex + 1) % themes.length
        setTheme(themes[nextIndex].value)
      }}
      className={`
        btn-icon relative overflow-hidden
        ${showLabel ? 'flex items-center space-x-2 px-3 py-2' : 'w-10 h-10'}
      `}
      whileTap={{ scale: 0.95 }}
      title={`Current theme: ${currentTheme?.label} (${actualTheme})`}
    >
      <motion.div
        key={theme}
        initial={{ rotate: -90, opacity: 0 }}
        animate={{ rotate: 0, opacity: 1 }}
        exit={{ rotate: 90, opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="flex items-center justify-center"
      >
        <CurrentIcon
          className={`
            ${showLabel ? 'w-4 h-4' : 'w-5 h-5'}
            ${actualTheme === 'dark' ? 'text-yellow-400' : 'text-surface-600'}
          `}
        />
      </motion.div>

      {showLabel && (
        <span className="text-sm font-medium text-surface-700 dark:text-surface-300">
          {currentTheme?.label}
        </span>
      )}

      {/* Background indicator */}
      <motion.div
        className="absolute inset-0 rounded-lg"
        animate={{
          backgroundColor: actualTheme === 'dark'
            ? 'rgba(59, 130, 246, 0.1)'
            : 'rgba(251, 191, 36, 0.1)'
        }}
        transition={{ duration: 0.3 }}
      />
    </motion.button>
  )
}

// Quick theme switcher with all options
export function ThemeSelector() {
  const { theme, setTheme } = useTheme()

  const themes = [
    { value: 'light', icon: Sun, label: 'Light', color: 'text-amber-500' },
    { value: 'dark', icon: Moon, label: 'Dark', color: 'text-blue-400' },
    { value: 'system', icon: Monitor, label: 'System', color: 'text-surface-500' },
  ] as const

  return (
    <div className="flex items-center space-x-1 p-1 bg-surface-100 dark:bg-surface-800 rounded-lg">
      {themes.map((t) => {
        const Icon = t.icon
        const isActive = theme === t.value

        return (
          <motion.button
            key={t.value}
            onClick={() => setTheme(t.value)}
            className={`
              relative flex items-center justify-center w-8 h-8 rounded-md
              transition-all duration-200
              ${isActive
                ? 'bg-white dark:bg-surface-700 shadow-sm'
                : 'hover:bg-surface-200 dark:hover:bg-surface-700'
              }
            `}
            whileTap={{ scale: 0.95 }}
            title={`Switch to ${t.label.toLowerCase()} mode`}
          >
            <Icon
              className={`w-4 h-4 ${isActive ? t.color : 'text-surface-400'}`}
            />

            {isActive && (
              <motion.div
                layoutId="theme-indicator"
                className="absolute inset-0 bg-white dark:bg-surface-700 rounded-md"
                style={{ zIndex: -1 }}
                transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
              />
            )}
          </motion.button>
        )
      })}
    </div>
  )
}