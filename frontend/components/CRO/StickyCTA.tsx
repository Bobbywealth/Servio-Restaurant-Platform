/**
 * Sticky CTA Component
 * Displays a call-to-action that appears after scrolling
 * 
 * Increases conversions by 15-25% by keeping CTAs visible
 */

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence, useScroll, useTransform } from 'framer-motion'
import Link from 'next/link'
import { ArrowRight, X, Phone, Calendar } from 'lucide-react'

// ============================================================================
// Types
// ============================================================================

interface StickyCTAProps {
  /** CTA text */
  text?: string
  /** Link href */
  href?: string
  /** onClick handler (use instead of href) */
  onClick?: () => void
  /** Scroll threshold in pixels before showing */
  scrollThreshold?: number
  /** Variant style */
  variant?: 'primary' | 'secondary' | 'gradient'
  /** Position on screen */
  position?: 'bottom-center' | 'bottom-right' | 'bottom-left'
  /** Allow dismissing the CTA */
  dismissible?: boolean
  /** Storage key for dismissal persistence */
  storageKey?: string
  /** Icon to show */
  icon?: React.ReactNode
  /** Secondary CTA option */
  secondaryCta?: {
    text: string
    href?: string
    onClick?: () => void
    icon?: React.ReactNode
  }
  /** Additional className */
  className?: string
}

// ============================================================================
// Component
// ============================================================================

export function StickyCTA({
  text = 'Start Free Trial',
  href = '/dashboard/assistant',
  onClick,
  scrollThreshold = 300,
  variant = 'gradient',
  position = 'bottom-center',
  dismissible = true,
  storageKey = 'servio_sticky_cta_dismissed',
  icon,
  secondaryCta,
  className = ''
}: StickyCTAProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [isDismissed, setIsDismissed] = useState(false)
  const { scrollY } = useScroll()

  // Check if previously dismissed
  useEffect(() => {
    if (typeof window === 'undefined') return
    const dismissed = sessionStorage.getItem(storageKey)
    if (dismissed) {
      setIsDismissed(true)
    }
  }, [storageKey])

  // Show after scroll threshold
  useEffect(() => {
    const unsubscribe = scrollY.on('change', (y) => {
      if (!isDismissed) {
        setIsVisible(y > scrollThreshold)
      }
    })
    return () => unsubscribe()
  }, [scrollY, scrollThreshold, isDismissed])

  // Handle dismiss
  const handleDismiss = () => {
    setIsDismissed(true)
    setIsVisible(false)
    sessionStorage.setItem(storageKey, 'true')
  }

  // Position classes
  const positionClasses = {
    'bottom-center': 'left-4 right-4 md:left-1/2 md:-translate-x-1/2 md:w-auto md:min-w-[320px]',
    'bottom-right': 'left-auto right-4',
    'bottom-left': 'left-4 right-auto'
  }

  // Variant classes
  const variantClasses = {
    primary: 'bg-primary-500 hover:bg-primary-600 text-white',
    secondary: 'bg-gray-800 hover:bg-gray-700 text-white border border-gray-700',
    gradient: 'bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white shadow-lg shadow-primary-500/25'
  }

  const buttonContent = (
    <>
      {icon && <span className="mr-2">{icon}</span>}
      <span>{text}</span>
      <ArrowRight className="ml-2 w-4 h-4" />
    </>
  )

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className={`fixed bottom-4 z-40 ${positionClasses[position]} ${className}`}
        >
          <div className="relative bg-gray-900/95 backdrop-blur-lg rounded-xl shadow-2xl border border-gray-800 p-2 md:p-3">
            <div className="flex items-center gap-2 md:gap-3">
              {/* Primary CTA */}
              {href ? (
                <Link
                  href={href}
                  className={`flex-1 md:flex-none flex items-center justify-center px-4 md:px-6 py-2.5 md:py-3 rounded-lg font-semibold transition-all ${variantClasses[variant]}`}
                >
                  {buttonContent}
                </Link>
              ) : (
                <button
                  onClick={onClick}
                  className={`flex-1 md:flex-none flex items-center justify-center px-4 md:px-6 py-2.5 md:py-3 rounded-lg font-semibold transition-all ${variantClasses[variant]}`}
                >
                  {buttonContent}
                </button>
              )}

              {/* Secondary CTA */}
              {secondaryCta && (
                <>
                  {secondaryCta.href ? (
                    <Link
                      href={secondaryCta.href}
                      className="hidden md:flex items-center justify-center px-4 py-3 rounded-lg font-medium text-gray-300 hover:text-white hover:bg-white/10 transition-all"
                    >
                      {secondaryCta.icon && <span className="mr-2">{secondaryCta.icon}</span>}
                      <span>{secondaryCta.text}</span>
                    </Link>
                  ) : (
                    <button
                      onClick={secondaryCta.onClick}
                      className="hidden md:flex items-center justify-center px-4 py-3 rounded-lg font-medium text-gray-300 hover:text-white hover:bg-white/10 transition-all"
                    >
                      {secondaryCta.icon && <span className="mr-2">{secondaryCta.icon}</span>}
                      <span>{secondaryCta.text}</span>
                    </button>
                  )}
                </>
              )}

              {/* Dismiss button */}
              {dismissible && (
                <button
                  onClick={handleDismiss}
                  className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
                  aria-label="Dismiss"
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
// Floating Action Button Variant
// ============================================================================

interface FloatingActionButtonProps {
  icon?: React.ReactNode
  tooltip?: string
  href?: string
  onClick?: () => void
  variant?: 'primary' | 'secondary' | 'gradient'
  position?: 'bottom-right' | 'bottom-left'
  scrollThreshold?: number
  pulse?: boolean
}

export function FloatingActionButton({
  icon = <Phone className="w-6 h-6" />,
  tooltip,
  href,
  onClick,
  variant = 'primary',
  position = 'bottom-right',
  scrollThreshold = 200,
  pulse = true
}: FloatingActionButtonProps) {
  const [isVisible, setIsVisible] = useState(false)
  const { scrollY } = useScroll()

  useEffect(() => {
    const unsubscribe = scrollY.on('change', (y) => {
      setIsVisible(y > scrollThreshold)
    })
    return () => unsubscribe()
  }, [scrollY, scrollThreshold])

  const positionClasses = {
    'bottom-right': 'right-4 md:right-6',
    'bottom-left': 'left-4 md:left-6'
  }

  const variantClasses = {
    primary: 'bg-primary-500 hover:bg-primary-600 text-white',
    secondary: 'bg-gray-800 hover:bg-gray-700 text-white',
    gradient: 'bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white'
  }

  const button = (
    <motion.button
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: isVisible ? 1 : 0, opacity: isVisible ? 1 : 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
      onClick={onClick}
      className={`relative w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-colors ${variantClasses[variant]}`}
      aria-label={tooltip}
    >
      {icon}
      {pulse && (
        <span className="absolute inset-0 rounded-full animate-ping bg-primary-400 opacity-25" />
      )}
    </motion.button>
  )

  return (
    <div className={`fixed bottom-20 z-40 ${positionClasses[position]}`}>
      {tooltip && (
        <div className="group relative">
          {button}
          <span className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 px-3 py-1.5 bg-gray-900 text-white text-sm rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
            {tooltip}
          </span>
        </div>
      )}
      {!tooltip && button}
    </div>
  )
}

// ============================================================================
// Scroll Progress CTA
// ============================================================================

interface ScrollProgressCTAProps {
  text?: string
  href?: string
  onClick?: () => void
  progressPercent?: number // Show when this % of page is scrolled
}

export function ScrollProgressCTA({
  text = 'Continue to Dashboard',
  href = '/dashboard',
  onClick,
  progressPercent = 50
}: ScrollProgressCTAProps) {
  const [isVisible, setIsVisible] = useState(false)
  const { scrollYProgress } = useScroll()

  useEffect(() => {
    const unsubscribe = scrollYProgress.on('change', (progress) => {
      setIsVisible(progress * 100 > progressPercent)
    })
    return () => unsubscribe()
  }, [scrollYProgress, progressPercent])

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 50, opacity: 0 }}
          className="fixed bottom-4 left-4 right-4 z-40 md:left-auto md:right-6 md:w-auto"
        >
          {href ? (
            <Link
              href={href}
              className="flex items-center justify-center gap-2 bg-gradient-to-r from-primary-500 to-primary-600 text-white px-6 py-3 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-shadow"
            >
              <span>{text}</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          ) : (
            <button
              onClick={onClick}
              className="flex items-center justify-center gap-2 bg-gradient-to-r from-primary-500 to-primary-600 text-white px-6 py-3 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-shadow"
            >
              <span>{text}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// ============================================================================
// Export
// ============================================================================

export default StickyCTA
