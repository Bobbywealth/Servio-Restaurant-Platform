/**
 * Exit Intent Popup Component
 * Captures leaving visitors with targeted offers
 * 
 * Research shows exit-intent popups can recover 10-15% of abandoning visitors
 */

import React, { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Gift, Mail, Sparkles, ArrowRight } from 'lucide-react'

// ============================================================================
// Types
// ============================================================================

interface ExitIntentPopupProps {
  /** Title of the popup */
  title?: string
  /** Subtitle/description */
  subtitle?: string
  /** Discount percentage or offer */
  offer?: string
  /** CTA button text */
  ctaText?: string
  /** Dismiss link text */
  dismissText?: string
  /** Storage key to prevent repeat shows */
  storageKey?: string
  /** Days until popup can show again after dismissal */
  dismissDays?: number
  /** Callback when form is submitted */
  onSubmit?: (email: string) => void | Promise<void>
  /** Show popup after time on page (ms) - alternative to exit intent */
  timeDelay?: number
  /** Custom content instead of email form */
  customContent?: React.ReactNode
}

// ============================================================================
// Animation Variants
// ============================================================================

const overlayVariants = {
  hidden: { opacity: 0 },
  visible: { 
    opacity: 1,
    transition: { duration: 0.3 }
  },
  exit: { 
    opacity: 0,
    transition: { duration: 0.2 }
  }
}

const modalVariants = {
  hidden: { 
    opacity: 0, 
    scale: 0.9,
    y: 20
  },
  visible: { 
    opacity: 1, 
    scale: 1,
    y: 0,
    transition: { 
      type: 'spring',
      stiffness: 300,
      damping: 25
    }
  },
  exit: { 
    opacity: 0, 
    scale: 0.9,
    y: 20,
    transition: { duration: 0.2 }
  }
}

// ============================================================================
// Component
// ============================================================================

export function ExitIntentPopup({
  title = "Wait! Don't Miss Out",
  subtitle = "Join 500+ restaurants already using Servio to streamline operations and boost revenue.",
  offer = "20%",
  ctaText = "Claim My Discount",
  dismissText = "No thanks, I'll pay full price",
  storageKey = 'servio_exit_popup_dismissed',
  dismissDays = 7,
  onSubmit,
  timeDelay,
  customContent
}: ExitIntentPopupProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [email, setEmail] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [error, setError] = useState('')

  // Check if popup was recently dismissed
  const wasRecentlyDismissed = useCallback(() => {
    if (typeof window === 'undefined') return false
    const dismissed = localStorage.getItem(storageKey)
    if (!dismissed) return false
    const dismissedTime = parseInt(dismissed, 10)
    const daysPassed = (Date.now() - dismissedTime) / (1000 * 60 * 60 * 24)
    return daysPassed < dismissDays
  }, [storageKey, dismissDays])

  // Handle exit intent (mouse leaving viewport)
  useEffect(() => {
    if (wasRecentlyDismissed()) return

    const handleMouseLeave = (e: MouseEvent) => {
      // Only trigger when mouse leaves from top
      if (e.clientY <= 0 && !isVisible) {
        setIsVisible(true)
      }
    }

    // Time delay alternative
    let timeoutId: NodeJS.Timeout | null = null
    if (timeDelay && !isVisible) {
      timeoutId = setTimeout(() => {
        setIsVisible(true)
      }, timeDelay)
    }

    document.addEventListener('mouseleave', handleMouseLeave)

    return () => {
      document.removeEventListener('mouseleave', handleMouseLeave)
      if (timeoutId) clearTimeout(timeoutId)
    }
  }, [isVisible, wasRecentlyDismissed, timeDelay])

  // Handle dismissal
  const handleDismiss = useCallback(() => {
    setIsVisible(false)
    localStorage.setItem(storageKey, Date.now().toString())
  }, [storageKey])

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

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!email) {
      setError('Please enter your email')
      return
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Please enter a valid email')
      return
    }

    setError('')
    setIsSubmitting(true)

    try {
      if (onSubmit) {
        await onSubmit(email)
      }
      setIsSuccess(true)
      // Auto-close after success
      setTimeout(() => {
        handleDismiss()
      }, 2000)
    } catch (err) {
      setError('Something went wrong. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Prevent body scroll when popup is visible
  useEffect(() => {
    if (isVisible) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isVisible])

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          variants={overlayVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) handleDismiss()
          }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="exit-popup-title"
        >
          <motion.div
            variants={modalVariants}
            className="relative w-full max-w-lg bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl shadow-2xl overflow-hidden"
          >
            {/* Decorative elements */}
            <div className="absolute top-0 right-0 w-40 h-40 bg-primary-500/10 rounded-full blur-3xl" />
            <div className="absolute bottom-0 left-0 w-32 h-32 bg-servio-orange-500/10 rounded-full blur-2xl" />
            
            {/* Close button */}
            <button
              onClick={handleDismiss}
              className="absolute top-4 right-4 p-2 rounded-full text-gray-400 hover:text-white hover:bg-white/10 transition-colors z-10"
              aria-label="Close popup"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Content */}
            <div className="relative p-8">
              {!isSuccess ? (
                <>
                  {/* Offer badge */}
                  <div className="flex justify-center mb-6">
                    <div className="flex items-center gap-2 bg-gradient-to-r from-primary-500 to-primary-600 text-white px-4 py-2 rounded-full text-sm font-semibold">
                      <Gift className="w-4 h-4" />
                      <span>Exclusive Offer</span>
                    </div>
                  </div>

                  {/* Title */}
                  <h2 
                    id="exit-popup-title"
                    className="text-2xl md:text-3xl font-bold text-white text-center mb-3"
                  >
                    {title}
                  </h2>

                  {/* Offer highlight */}
                  <div className="flex items-center justify-center gap-2 mb-4">
                    <Sparkles className="w-5 h-5 text-yellow-400" />
                    <span className="text-3xl font-bold text-primary-400">
                      {offer} OFF
                    </span>
                    <Sparkles className="w-5 h-5 text-yellow-400" />
                  </div>

                  {/* Subtitle */}
                  <p className="text-gray-400 text-center mb-6">
                    {subtitle}
                  </p>

                  {/* Form or custom content */}
                  {customContent || (
                    <form onSubmit={handleSubmit} className="space-y-4">
                      <div>
                        <label htmlFor="exit-email" className="sr-only">
                          Email address
                        </label>
                        <div className="relative">
                          <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                          <input
                            id="exit-email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="Enter your email"
                            className="w-full pl-12 pr-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                            aria-describedby={error ? 'exit-email-error' : undefined}
                          />
                        </div>
                        {error && (
                          <p 
                            id="exit-email-error" 
                            className="mt-2 text-sm text-red-400"
                            role="alert"
                          >
                            {error}
                          </p>
                        )}
                      </div>

                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white py-3 px-6 rounded-xl font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isSubmitting ? (
                          <>
                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            <span>Processing...</span>
                          </>
                        ) : (
                          <>
                            <span>{ctaText}</span>
                            <ArrowRight className="w-4 h-4" />
                          </>
                        )}
                      </button>
                    </form>
                  )}

                  {/* Dismiss link */}
                  <button
                    onClick={handleDismiss}
                    className="mt-4 text-gray-500 hover:text-gray-400 text-sm w-full text-center transition-colors"
                  >
                    {dismissText}
                  </button>
                </>
              ) : (
                /* Success state */
                <div className="text-center py-8">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                    className="w-16 h-16 mx-auto mb-4 bg-green-500/20 rounded-full flex items-center justify-center"
                  >
                    <svg
                      className="w-8 h-8 text-green-500"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  </motion.div>
                  <h3 className="text-xl font-bold text-white mb-2">
                    You're In! 🎉
                  </h3>
                  <p className="text-gray-400">
                    Check your email for your exclusive discount code.
                  </p>
                </div>
              )}
            </div>

            {/* Trust indicators */}
            <div className="px-8 pb-6">
              <div className="flex items-center justify-center gap-4 text-xs text-gray-500">
                <span className="flex items-center gap-1">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                  </svg>
                  Secure
                </span>
                <span>•</span>
                <span>No spam, ever</span>
                <span>•</span>
                <span>Unsubscribe anytime</span>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// ============================================================================
// Hook for programmatic control
// ============================================================================

export function useExitIntentPopup() {
  const [showPopup, setShowPopup] = useState(false)

  const trigger = useCallback(() => {
    setShowPopup(true)
  }, [])

  const close = useCallback(() => {
    setShowPopup(false)
  }, [])

  return { showPopup, trigger, close }
}

// ============================================================================
// Export
// ============================================================================

export default ExitIntentPopup
