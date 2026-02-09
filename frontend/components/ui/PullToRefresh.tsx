import React, { useRef, useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { RefreshCw } from 'lucide-react'

interface PullToRefreshProps {
  onRefresh: () => Promise<void>
  children: React.ReactNode
  disabled?: boolean
}

export const PullToRefresh: React.FC<PullToRefreshProps> = ({
  onRefresh,
  children,
  disabled = false
}) => {
  const [pullDistance, setPullDistance] = useState(0)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [canPull, setCanPull] = useState(false)
  const startY = useRef(0)
  const currentY = useRef(0)

  const maxPullDistance = 100
  const triggerDistance = 60

  useEffect(() => {
    if (disabled) return
    if (typeof window === 'undefined' || typeof document === 'undefined') return

    const handleTouchStart = (e: TouchEvent) => {
      // Only allow pull-to-refresh at the top of the page
      if (window.scrollY === 0) {
        startY.current = e.touches[0].clientY
        setCanPull(true)
      }
    }

    const handleTouchMove = (e: TouchEvent) => {
      if (!canPull || isRefreshing) return

      currentY.current = e.touches[0].clientY
      const distance = currentY.current - startY.current

      // Only pull down
      if (distance > 0 && window.scrollY === 0) {
        // Prevent default scroll behavior when pulling
        if (distance > 10) {
          e.preventDefault()
        }

        // Apply resistance curve for natural feel
        const resistance = Math.min(distance / 2.5, maxPullDistance)
        setPullDistance(resistance)
      }
    }

    const handleTouchEnd = async () => {
      if (!canPull || isRefreshing) return

      setCanPull(false)

      if (pullDistance >= triggerDistance) {
        setIsRefreshing(true)
        setPullDistance(triggerDistance)

        try {
          await onRefresh()
        } catch (error) {
          console.error('Refresh failed:', error)
        } finally {
          setIsRefreshing(false)
          setPullDistance(0)
        }
      } else {
        setPullDistance(0)
      }

      startY.current = 0
      currentY.current = 0
    }

    document.addEventListener('touchstart', handleTouchStart, { passive: true })
    document.addEventListener('touchmove', handleTouchMove, { passive: false })
    document.addEventListener('touchend', handleTouchEnd)

    return () => {
      document.removeEventListener('touchstart', handleTouchStart)
      document.removeEventListener('touchmove', handleTouchMove)
      document.removeEventListener('touchend', handleTouchEnd)
    }
  }, [canPull, pullDistance, isRefreshing, onRefresh, disabled])

  const iconRotation = isRefreshing ? 360 : (pullDistance / triggerDistance) * 360
  const iconOpacity = Math.min(pullDistance / triggerDistance, 1)

  return (
    <div className="relative">
      <AnimatePresence>
        {pullDistance > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed top-0 left-0 right-0 z-50 flex justify-center pointer-events-none"
            style={{
              paddingTop: `calc(env(safe-area-inset-top, 0px) + ${pullDistance}px)`
            }}
          >
            <motion.div
              className="bg-white dark:bg-surface-800 rounded-full shadow-lg p-2"
              style={{ opacity: iconOpacity }}
            >
              <motion.div
                animate={{
                  rotate: isRefreshing ? 360 : iconRotation
                }}
                transition={{
                  duration: isRefreshing ? 1 : 0,
                  repeat: isRefreshing ? Infinity : 0,
                  ease: 'linear'
                }}
              >
                <RefreshCw
                  className={`w-5 h-5 ${
                    isRefreshing
                      ? 'text-primary-600'
                      : pullDistance >= triggerDistance
                      ? 'text-servio-green-500'
                      : 'text-surface-400'
                  }`}
                />
              </motion.div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        animate={{
          y: isRefreshing ? triggerDistance : pullDistance
        }}
        transition={{
          type: 'spring',
          stiffness: 300,
          damping: 30
        }}
      >
        {children}
      </motion.div>
    </div>
  )
}
