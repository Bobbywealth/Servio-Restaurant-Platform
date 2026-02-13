import React, { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import Link from 'next/link'
import { ArrowRight, X, Mic } from 'lucide-react'

export interface StickyCTAProps {
  text?: string
  href?: string
  onClick?: () => void
  scrollThreshold?: number
  variant?: 'solid' | 'gradient' | 'outline'
  dismissible?: boolean
  position?: 'bottom' | 'top'
  className?: string
}

/**
 * StickyCTA Component
 * 
 * A sticky call-to-action bar that appears after scrolling:
 * - Shows after scroll threshold
 * - Dismissible with localStorage memory
 * - Multiple visual variants
 * - Accessible with keyboard navigation
 * 
 * Best practices:
 * - Use action-oriented text
 * - High contrast for visibility
 * - Don't block important content
 * - Allow dismissal
 */
export function StickyCTA({
  text = 'Get Started Free',
  href,
  onClick,
  scrollThreshold = 300,
  variant = 'gradient',
  dismissible = true,
  position = 'bottom',
  className = '',
}: StickyCTAProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [isDismissed, setIsDismissed] = useState(false)
  const shouldReduceMotion = useReducedMotion()

  const STORAGE_KEY = 'servio_sticky_cta_dismissed'

  useEffect(() => {
    // Check if previously dismissed
    const dismissed = localStorage.getItem(STORAGE_KEY)
    if (dismissed) {
      setIsDismissed(true)
    }

    const handleScroll = () => {
      if (isDismissed) return
      
      const scrollY = window.scrollY
      const shouldShow = scrollY > scrollThreshold
      
      setIsVisible(shouldShow)
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    handleScroll() // Check initial state

    return () => window.removeEventListener('scroll', handleScroll)
  }, [scrollThreshold, isDismissed])

  const handleDismiss = useCallback(() => {
    setIsVisible(false)
    setIsDismissed(true)
    localStorage.setItem(STORAGE_KEY, Date.now().toString())
  }, [])

  const buttonClasses = {
    solid: 'bg-primary-500 hover:bg-primary-600 text-white',
    gradient: 'bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white shadow-lg shadow-primary-500/30',
    outline: 'bg-white/10 hover:bg-white/20 text-white border border-white/20',
  }

  const positionClasses = {
    bottom: 'bottom-0 left-0 right-0',
    top: 'top-16 left-0 right-0',
  }

  const CTAContent = () => (
    <span className="flex items-center gap-2">
      <Mic className="w-5 h-5" aria-hidden="true" />
      <span>{text}</span>
      <ArrowRight className="w-4 h-4" aria-hidden="true" />
    </span>
  )

  return (
    <AnimatePresence>
      {isVisible && !isDismissed && (
        <motion.div
          initial={shouldReduceMotion ? undefined : { y: position === 'bottom' ? 100 : -100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={shouldReduceMotion ? undefined : { y: position === 'bottom' ? 100 : -100, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className={`fixed ${positionClasses[position]} z-40 ${className}`}
        >
          <div className="bg-gray-900/95 backdrop-blur-xl border-t border-white/10 px-4 py-3">
            <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
              <p className="text-sm text-gray-300 hidden sm:block">
                Ready to streamline your restaurant operations?
              </p>
              
              <div className="flex items-center gap-3 ml-auto">
                {href ? (
                  <Link
                    href={href}
                    className={`inline-flex items-center px-6 py-2.5 rounded-xl font-semibold transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900 ${buttonClasses[variant]}`}
                  >
                    <CTAContent />
                  </Link>
                ) : (
                  <button
                    onClick={onClick}
                    className={`inline-flex items-center px-6 py-2.5 rounded-xl font-semibold transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900 ${buttonClasses[variant]}`}
                  >
                    <CTAContent />
                  </button>
                )}

                {dismissible && (
                  <button
                    onClick={handleDismiss}
                    className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                    aria-label="Dismiss"
                  >
                    <X className="w-5 h-5" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export default StickyCTA
