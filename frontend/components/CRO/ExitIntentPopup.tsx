import React, { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { X, Gift, Mail, Sparkles, ArrowRight } from 'lucide-react'

export interface ExitIntentPopupProps {
  title?: string
  subtitle?: string
  offer?: string
  ctaText?: string
  onSubmit?: (email: string) => Promise<void> | void
  onDismiss?: () => void
  cooldownHours?: number
  delayMs?: number
  className?: string
}

/**
 * ExitIntentPopup Component
 * 
 * Captures leaving visitors with a targeted offer:
 * - Detects mouse leaving viewport (desktop)
 * - Detects back button gesture (mobile)
 * - Shows after scroll threshold
 * - Respects cooldown period to avoid annoyance
 * 
 * Best practices:
 * - Offer real value (discount, free trial, etc.)
 * - Keep form minimal (email only)
 * - Clear, compelling headline
 * - Easy to dismiss
 * - Store dismissal in localStorage
 */
export function ExitIntentPopup({
  title = "Don't Miss Out!",
  subtitle = 'Join thousands of restaurants already using Servio.',
  offer = '20%',
  ctaText = 'Claim My Discount',
  onSubmit,
  onDismiss,
  cooldownHours = 24,
  delayMs = 2000,
  className = '',
}: ExitIntentPopupProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [email, setEmail] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [error, setError] = useState('')
  const shouldReduceMotion = useReducedMotion()
  const hasShownRef = useRef(false)

  const STORAGE_KEY = 'servio_exit_intent_dismissed'

  const checkCooldown = useCallback(() => {
    const dismissedAt = localStorage.getItem(STORAGE_KEY)
    if (dismissedAt) {
      const hoursSinceDismissed = (Date.now() - parseInt(dismissedAt, 10)) / (1000 * 60 * 60)
      return hoursSinceDismissed >= cooldownHours
    }
    return true
  }, [cooldownHours])

  const handleDismiss = useCallback(() => {
    setIsVisible(false)
    localStorage.setItem(STORAGE_KEY, Date.now().toString())
    onDismiss?.()
  }, [onDismiss])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !email.includes('@')) {
      setError('Please enter a valid email address')
      return
    }

    setIsSubmitting(true)
    setError('')

    try {
      await onSubmit?.(email)
      setIsSuccess(true)
      localStorage.setItem(STORAGE_KEY, Date.now().toString())
      setTimeout(() => {
        setIsVisible(false)
      }, 2000)
    } catch (err) {
      setError('Something went wrong. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  useEffect(() => {
    // Check if already shown in this session
    if (hasShownRef.current) return

    const timer = setTimeout(() => {
      if (!checkCooldown()) return

      // Desktop: Mouse leave detection
      const handleMouseLeave = (e: MouseEvent) => {
        if (e.clientY <= 0 && !hasShownRef.current) {
          hasShownRef.current = true
          setIsVisible(true)
        }
      }

      // Mobile: Scroll up detection (fast scroll to top)
      let lastScrollY = window.scrollY
      const handleScroll = () => {
        const currentScrollY = window.scrollY
        const scrollDiff = lastScrollY - currentScrollY
        
        // If scrolling up fast near the top
        if (scrollDiff > 100 && currentScrollY < 200 && !hasShownRef.current) {
          hasShownRef.current = true
          setIsVisible(true)
        }
        
        lastScrollY = currentScrollY
      }

      // Also show after spending significant time on page
      const timeOnPageTimer = setTimeout(() => {
        if (!hasShownRef.current && checkCooldown()) {
          hasShownRef.current = true
          setIsVisible(true)
        }
      }, 30000) // 30 seconds

      document.addEventListener('mouseleave', handleMouseLeave)
      window.addEventListener('scroll', handleScroll, { passive: true })

      return () => {
        document.removeEventListener('mouseleave', handleMouseLeave)
        window.removeEventListener('scroll', handleScroll)
        clearTimeout(timeOnPageTimer)
      }
    }, delayMs)

    return () => clearTimeout(timer)
  }, [delayMs, checkCooldown])

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isVisible) {
        handleDismiss()
      }
    }

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [isVisible, handleDismiss])

  return (
    <AnimatePresence>
      {isVisible && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleDismiss}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[100]"
            aria-hidden="true"
          />

          {/* Modal */}
          <motion.div
            initial={shouldReduceMotion ? undefined : { opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={shouldReduceMotion ? undefined : { opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className={`fixed inset-0 z-[101] flex items-center justify-center p-4 ${className}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="exit-intent-title"
          >
            <div className="relative w-full max-w-lg bg-gradient-to-b from-gray-800 to-gray-900 rounded-3xl shadow-2xl border border-white/10 overflow-hidden">
              {/* Close button */}
              <button
                onClick={handleDismiss}
                className="absolute top-4 right-4 p-2 rounded-full text-gray-400 hover:text-white hover:bg-white/10 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                aria-label="Close popup"
              >
                <X className="w-5 h-5" />
              </button>

              {/* Content */}
              <div className="p-8 md:p-10">
                {isSuccess ? (
                  <div className="text-center py-8">
                    <motion.div
                      initial={shouldReduceMotion ? undefined : { scale: 0 }}
                      animate={{ scale: 1 }}
                      className="w-16 h-16 rounded-full bg-servio-green-500/20 flex items-center justify-center mx-auto mb-6"
                    >
                      <Sparkles className="w-8 h-8 text-servio-green-400" />
                    </motion.div>
                    <h3 className="text-2xl font-bold text-white mb-2">You're In!</h3>
                    <p className="text-gray-400">Check your email for your exclusive discount code.</p>
                  </div>
                ) : (
                  <>
                    {/* Icon */}
                    <div className="flex justify-center mb-6">
                      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-500 to-servio-purple-500 flex items-center justify-center">
                        <Gift className="w-8 h-8 text-white" />
                      </div>
                    </div>

                    {/* Offer badge */}
                    <div className="flex justify-center mb-4">
                      <span className="inline-flex items-center px-4 py-1.5 rounded-full bg-servio-orange-500/20 border border-servio-orange-500/30 text-servio-orange-300 text-sm font-semibold">
                        Save {offer} on Your First Month
                      </span>
                    </div>

                    {/* Title */}
                    <h2 id="exit-intent-title" className="text-2xl md:text-3xl font-bold text-white text-center mb-3">
                      {title}
                    </h2>
                    <p className="text-gray-400 text-center mb-8">{subtitle}</p>

                    {/* Form */}
                    <form onSubmit={handleSubmit} className="space-y-4">
                      <div>
                        <label htmlFor="exit-email" className="sr-only">
                          Email address
                        </label>
                        <div className="relative">
                          <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                          <input
                            type="email"
                            id="exit-email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="Enter your email"
                            className="w-full pl-12 pr-4 py-4 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                            autoComplete="email"
                          />
                        </div>
                        {error && (
                          <p className="mt-2 text-sm text-red-400" role="alert">
                            {error}
                          </p>
                        )}
                      </div>

                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white py-4 rounded-xl font-semibold transition-all duration-300 shadow-lg shadow-primary-500/25 hover:shadow-primary-500/40 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isSubmitting ? (
                          <span>Submitting...</span>
                        ) : (
                          <>
                            <span>{ctaText}</span>
                            <ArrowRight className="w-5 h-5" />
                          </>
                        )}
                      </button>
                    </form>

                    {/* Trust text */}
                    <p className="mt-4 text-xs text-gray-500 text-center">
                      No spam, ever. Unsubscribe anytime.
                    </p>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

export default ExitIntentPopup
