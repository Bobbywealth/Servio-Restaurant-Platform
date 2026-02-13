import React, { useState, useEffect } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { Clock, Users, Flame, Zap, X } from 'lucide-react'

export interface UrgencyBannerProps {
  variant?: 'countdown' | 'social-proof' | 'limited' | 'flash'
  message?: string
  endDate?: Date
  count?: number
  actionText?: string
  onAction?: () => void
  onDismiss?: () => void
  dismissible?: boolean
  className?: string
}

/**
 * UrgencyBanner Component
 * 
 * Creates urgency to drive conversions:
 * - Countdown timer for limited offers
 * - Social proof (X people viewing)
 * - Limited availability messaging
 * - Flash sale alerts
 * 
 * Best practices:
 * - Use sparingly to avoid banner blindness
 * - Ensure urgency is genuine
 * - Allow dismissal
 * - Keep messages concise
 */
export function UrgencyBanner({
  variant = 'countdown',
  message,
  endDate,
  count = 12,
  actionText,
  onAction,
  onDismiss,
  dismissible = true,
  className = '',
}: UrgencyBannerProps) {
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 })
  const [isVisible, setIsVisible] = useState(true)
  const [currentCount, setCurrentCount] = useState(count)
  const shouldReduceMotion = useReducedMotion()

  // Countdown timer
  useEffect(() => {
    if (variant !== 'countdown' || !endDate) return

    const calculateTimeLeft = () => {
      const difference = endDate.getTime() - new Date().getTime()
      
      if (difference > 0) {
        setTimeLeft({
          days: Math.floor(difference / (1000 * 60 * 60 * 24)),
          hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
          minutes: Math.floor((difference / 1000 / 60) % 60),
          seconds: Math.floor((difference / 1000) % 60),
        })
      }
    }

    calculateTimeLeft()
    const timer = setInterval(calculateTimeLeft, 1000)
    return () => clearInterval(timer)
  }, [variant, endDate])

  // Social proof random fluctuation
  useEffect(() => {
    if (variant !== 'social-proof') return

    const interval = setInterval(() => {
      setCurrentCount((prev) => {
        const change = Math.random() > 0.5 ? 1 : -1
        return Math.max(5, Math.min(50, prev + change))
      })
    }, 5000)

    return () => clearInterval(interval)
  }, [variant])

  const handleDismiss = () => {
    setIsVisible(false)
    onDismiss?.()
  }

  if (!isVisible) return null

  const formatTime = (value: number) => value.toString().padStart(2, '0')

  // Countdown variant
  if (variant === 'countdown') {
    return (
      <motion.div
        initial={shouldReduceMotion ? undefined : { y: -50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className={`bg-gradient-to-r from-servio-orange-500 to-servio-orange-600 ${className}`}
      >
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-center gap-4">
          <Clock className="w-5 h-5 text-white flex-shrink-0" aria-hidden="true" />
          <p className="text-white text-sm md:text-base font-medium text-center">
            {message || 'Limited time offer ends in'}
          </p>
          <div className="flex items-center gap-1 text-white font-mono font-bold">
            {timeLeft.days > 0 && (
              <span className="bg-white/20 px-2 py-1 rounded">{formatTime(timeLeft.days)}d</span>
            )}
            <span className="bg-white/20 px-2 py-1 rounded">{formatTime(timeLeft.hours)}h</span>
            <span className="bg-white/20 px-2 py-1 rounded">{formatTime(timeLeft.minutes)}m</span>
            <span className="bg-white/20 px-2 py-1 rounded">{formatTime(timeLeft.seconds)}s</span>
          </div>
          {actionText && (
            <button
              onClick={onAction}
              className="text-white underline hover:no-underline font-semibold text-sm hidden sm:block"
            >
              {actionText}
            </button>
          )}
          {dismissible && (
            <button
              onClick={handleDismiss}
              className="ml-2 p-1 rounded hover:bg-white/20 transition-colors"
              aria-label="Dismiss banner"
            >
              <X className="w-4 h-4 text-white" />
            </button>
          )}
        </div>
      </motion.div>
    )
  }

  // Social proof variant
  if (variant === 'social-proof') {
    return (
      <motion.div
        initial={shouldReduceMotion ? undefined : { y: -50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className={`bg-gradient-to-r from-primary-500 to-primary-600 ${className}`}
      >
        <div className="max-w-7xl mx-auto px-4 py-2.5 flex items-center justify-center gap-3">
          <Users className="w-4 h-4 text-white flex-shrink-0" aria-hidden="true" />
          <p className="text-white text-sm font-medium">
            <span className="font-bold">{currentCount} people</span> are viewing this page right now
          </p>
          <motion.span
            animate={shouldReduceMotion ? undefined : { scale: [1, 1.2, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="w-2 h-2 bg-white rounded-full"
            aria-hidden="true"
          />
          {dismissible && (
            <button
              onClick={handleDismiss}
              className="ml-2 p-1 rounded hover:bg-white/20 transition-colors"
              aria-label="Dismiss banner"
            >
              <X className="w-4 h-4 text-white" />
            </button>
          )}
        </div>
      </motion.div>
    )
  }

  // Limited variant
  if (variant === 'limited') {
    return (
      <motion.div
        initial={shouldReduceMotion ? undefined : { y: -50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className={`bg-gradient-to-r from-red-500 to-red-600 ${className}`}
      >
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-center gap-3">
          <Flame className="w-5 h-5 text-white flex-shrink-0" aria-hidden="true" />
          <p className="text-white text-sm md:text-base font-medium text-center">
            {message || 'Only a few spots remaining for this month!'}
          </p>
          {actionText && (
            <button
              onClick={onAction}
              className="bg-white text-red-600 px-4 py-1.5 rounded-lg text-sm font-bold hover:bg-white/90 transition-colors"
            >
              {actionText}
            </button>
          )}
          {dismissible && (
            <button
              onClick={handleDismiss}
              className="ml-2 p-1 rounded hover:bg-white/20 transition-colors"
              aria-label="Dismiss banner"
            >
              <X className="w-4 h-4 text-white" />
            </button>
          )}
        </div>
      </motion.div>
    )
  }

  // Flash sale variant
  if (variant === 'flash') {
    return (
      <motion.div
        initial={shouldReduceMotion ? undefined : { y: -50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className={`bg-gradient-to-r from-servio-purple-500 to-servio-purple-600 ${className}`}
      >
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-center gap-3">
          <motion.div
            animate={shouldReduceMotion ? undefined : { rotate: [0, 10, -10, 0] }}
            transition={{ duration: 0.5, repeat: Infinity, repeatDelay: 2 }}
          >
            <Zap className="w-5 h-5 text-yellow-300 flex-shrink-0" aria-hidden="true" />
          </motion.div>
          <p className="text-white text-sm md:text-base font-bold text-center">
            {message || '⚡ FLASH SALE: 25% OFF for the next 2 hours!'}
          </p>
          {actionText && (
            <button
              onClick={onAction}
              className="bg-yellow-300 text-servio-purple-700 px-4 py-1.5 rounded-lg text-sm font-bold hover:bg-yellow-200 transition-colors"
            >
              {actionText}
            </button>
          )}
          {dismissible && (
            <button
              onClick={handleDismiss}
              className="ml-2 p-1 rounded hover:bg-white/20 transition-colors"
              aria-label="Dismiss banner"
            >
              <X className="w-4 h-4 text-white" />
            </button>
          )}
        </div>
      </motion.div>
    )
  }

  return null
}

export default UrgencyBanner
