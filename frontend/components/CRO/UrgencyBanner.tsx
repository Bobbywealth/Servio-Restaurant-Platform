/**
 * Urgency Banner Component
 * Creates urgency to encourage immediate action
 * 
 * Urgency elements can increase conversions by 15% for impulse purchases
 */

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Flame, Clock, Users, AlertTriangle, X, Zap } from 'lucide-react'

// ============================================================================
// Types
// ============================================================================

type UrgencyType = 'limited_spots' | 'countdown' | 'social_proof' | 'flash_sale' | 'custom'

interface UrgencyBannerProps {
  /** Type of urgency message */
  type?: UrgencyType
  /** Custom message (for type='custom') */
  message?: string
  /** Number for limited spots/social proof */
  count?: number
  /** Countdown end time (for type='countdown') */
  endTime?: Date
  /** Discount percentage (for type='flash_sale') */
  discount?: number
  /** Allow dismissing the banner */
  dismissible?: boolean
  /** Storage key for dismissal */
  storageKey?: string
  /** Position on page */
  position?: 'top' | 'floating'
  /** Additional className */
  className?: string
  /** CTA link */
  ctaLink?: string
  /** CTA text */
  ctaText?: string
}

// ============================================================================
// Countdown Timer Hook
// ============================================================================

function useCountdown(endTime: Date) {
  const [timeLeft, setTimeLeft] = useState(() => {
    const diff = endTime.getTime() - Date.now()
    return Math.max(0, diff)
  })

  useEffect(() => {
    const interval = setInterval(() => {
      const diff = endTime.getTime() - Date.now()
      if (diff <= 0) {
        setTimeLeft(0)
        clearInterval(interval)
      } else {
        setTimeLeft(diff)
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [endTime])

  const hours = Math.floor(timeLeft / (1000 * 60 * 60))
  const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60))
  const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000)

  return { hours, minutes, seconds, total: timeLeft }
}

// ============================================================================
// Countdown Display Component
// ============================================================================

function CountdownDisplay({ 
  hours, 
  minutes, 
  seconds 
}: { 
  hours: number
  minutes: number
  seconds: number 
}) {
  const TimeBlock = ({ value, label }: { value: number; label: string }) => (
    <div className="flex flex-col items-center">
      <span className="bg-black/20 px-2 py-1 rounded font-mono font-bold text-lg">
        {value.toString().padStart(2, '0')}
      </span>
      <span className="text-[10px] uppercase tracking-wider opacity-75 mt-0.5">
        {label}
      </span>
    </div>
  )

  return (
    <div className="flex items-center gap-1">
      <TimeBlock value={hours} label="HRS" />
      <span className="font-bold text-lg animate-pulse">:</span>
      <TimeBlock value={minutes} label="MIN" />
      <span className="font-bold text-lg animate-pulse">:</span>
      <TimeBlock value={seconds} label="SEC" />
    </div>
  )
}

// ============================================================================
// Main Component
// ============================================================================

export function UrgencyBanner({
  type = 'limited_spots',
  message,
  count = 12,
  endTime,
  discount = 20,
  dismissible = true,
  storageKey = 'servio_urgency_banner_dismissed',
  position = 'top',
  className = '',
  ctaLink,
  ctaText = 'Claim Now'
}: UrgencyBannerProps) {
  const [isDismissed, setIsDismissed] = useState(false)
  const [isVisible, setIsVisible] = useState(true)

  // Check if previously dismissed
  useEffect(() => {
    if (typeof window === 'undefined') return
    const dismissed = sessionStorage.getItem(storageKey)
    if (dismissed) {
      setIsDismissed(true)
    }
  }, [storageKey])

  // Handle dismiss
  const handleDismiss = () => {
    setIsVisible(false)
    sessionStorage.setItem(storageKey, 'true')
    setTimeout(() => setIsDismissed(true), 300)
  }

  // Get message content based on type
  const getContent = () => {
    switch (type) {
      case 'limited_spots':
        return {
          icon: <Flame className="w-5 h-5 animate-pulse" />,
          text: (
            <span className="flex items-center gap-2">
              <span className="font-semibold">Limited Time:</span>
              <span className="bg-white/20 px-2 py-0.5 rounded font-bold">
                {count} spots
              </span>
              <span>remaining for priority onboarding this month</span>
            </span>
          ),
          gradient: 'from-orange-500 to-red-500'
        }
      case 'countdown':
        if (!endTime) return null
        const { hours, minutes, seconds, total } = useCountdown(endTime)
        if (total <= 0) {
          return {
            icon: <AlertTriangle className="w-5 h-5" />,
            text: <span>Offer expired!</span>,
            gradient: 'from-gray-500 to-gray-600'
          }
        }
        return {
          icon: <Clock className="w-5 h-5 animate-bounce" />,
          text: (
            <span className="flex items-center gap-3">
              <span>Offer ends in:</span>
              <CountdownDisplay hours={hours} minutes={minutes} seconds={seconds} />
            </span>
          ),
          gradient: 'from-purple-500 to-pink-500'
        }
      case 'social_proof':
        return {
          icon: <Users className="w-5 h-5" />,
          text: (
            <span className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1">
                <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                <span>{count} restaurants</span>
              </span>
              <span>signed up this week</span>
            </span>
          ),
          gradient: 'from-green-500 to-emerald-500'
        }
      case 'flash_sale':
        return {
          icon: <Zap className="w-5 h-5 animate-bounce" />,
          text: (
            <span className="flex items-center gap-2">
              <span className="font-bold">FLASH SALE:</span>
              <span className="bg-white/20 px-2 py-0.5 rounded font-bold text-lg">
                {discount}% OFF
              </span>
              <span>for the next 24 hours only!</span>
            </span>
          ),
          gradient: 'from-yellow-500 to-orange-500'
        }
      case 'custom':
      default:
        return {
          icon: <Flame className="w-5 h-5" />,
          text: <span>{message}</span>,
          gradient: 'from-primary-500 to-primary-600'
        }
    }
  }

  if (isDismissed) return null

  const content = getContent()
  if (!content) return null

  const positionClasses = position === 'top' 
    ? 'top-0 left-0 right-0' 
    : 'bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-auto'

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ y: position === 'top' ? -100 : 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: position === 'top' ? -100 : 100, opacity: 0 }}
          className={`fixed ${positionClasses} z-50 ${className}`}
        >
          <div 
            className={`bg-gradient-to-r ${content.gradient} text-white py-2.5 px-4 ${
              position === 'top' ? '' : 'rounded-xl shadow-lg'
            }`}
          >
            <div className="max-w-7xl mx-auto flex items-center justify-center gap-4">
              {/* Icon */}
              <span className="flex-shrink-0">
                {content.icon}
              </span>

              {/* Message */}
              <div className="flex-1 text-center text-sm md:text-base">
                {content.text}
              </div>

              {/* CTA */}
              {ctaLink && (
                <a
                  href={ctaLink}
                  className="hidden md:inline-flex items-center gap-1 bg-white/20 hover:bg-white/30 px-3 py-1 rounded-lg text-sm font-semibold transition-colors"
                >
                  {ctaText}
                </a>
              )}

              {/* Dismiss */}
              {dismissible && (
                <button
                  onClick={handleDismiss}
                  className="flex-shrink-0 p-1 hover:bg-white/20 rounded transition-colors"
                  aria-label="Dismiss banner"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// ============================================================================
// Live Activity Indicator
// ============================================================================

interface ActivityIndicatorProps {
  /** Activity messages to cycle through */
  messages?: string[]
  /** Interval between messages in ms */
  interval?: number
  /** Position */
  position?: 'bottom-left' | 'bottom-right'
  /** Additional className */
  className?: string
}

export function ActivityIndicator({
  messages = [
    "Sarah from NYC just signed up",
    "Mike from LA started his free trial",
    "A restaurant in Chicago processed 50 orders",
    "Jennifer in Miami upgraded to Pro"
  ],
  interval = 8000,
  position = 'bottom-left',
  className = ''
}: ActivityIndicatorProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    // Show after delay
    const showTimeout = setTimeout(() => {
      setIsVisible(true)
    }, 5000)

    // Cycle through messages
    const messageInterval = setInterval(() => {
      setIsVisible(false)
      setTimeout(() => {
        setCurrentIndex((prev) => (prev + 1) % messages.length)
        setIsVisible(true)
      }, 500)
    }, interval)

    return () => {
      clearTimeout(showTimeout)
      clearInterval(messageInterval)
    }
  }, [messages.length, interval])

  const positionClasses = {
    'bottom-left': 'left-4 bottom-24',
    'bottom-right': 'right-4 bottom-24'
  }

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, x: position === 'bottom-left' ? -50 : 50, scale: 0.9 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          exit={{ opacity: 0, x: position === 'bottom-left' ? -50 : 50, scale: 0.9 }}
          className={`fixed ${positionClasses[position]} z-40 max-w-xs ${className}`}
        >
          <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-3 flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
              <Users className="w-4 h-4 text-green-600" />
            </div>
            <p className="text-sm text-gray-700">
              {messages[currentIndex]}
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// ============================================================================
// Stock Level Indicator
// ============================================================================

interface StockLevelProps {
  /** Current stock level */
  current: number
  /** Maximum stock (for percentage calculation) */
  max?: number
  /** Low stock threshold */
  lowThreshold?: number
  /** Show progress bar */
  showBar?: boolean
  /** Additional className */
  className?: string
}

export function StockLevel({
  current,
  max = 50,
  lowThreshold = 10,
  showBar = true,
  className = ''
}: StockLevelProps) {
  const percentage = (current / max) * 100
  const isLow = current <= lowThreshold

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <div className="flex items-center gap-2">
        <span className={`w-2 h-2 rounded-full ${isLow ? 'bg-red-500 animate-pulse' : 'bg-green-500'}`} />
        <span className={`text-sm font-medium ${isLow ? 'text-red-600' : 'text-gray-600'}`}>
          {isLow ? 'Only ' : ''}{current} spots left
        </span>
      </div>
      {showBar && (
        <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden max-w-[100px]">
          <div
            className={`h-full rounded-full transition-all ${
              isLow ? 'bg-red-500' : 'bg-green-500'
            }`}
            style={{ width: `${percentage}%` }}
          />
        </div>
      )}
    </div>
  )
}

// ============================================================================
// Export
// ============================================================================

export default UrgencyBanner
