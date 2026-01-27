import React from 'react'
import { motion, Easing } from 'framer-motion'

interface SkeletonProps {
  className?: string
  variant?: 'text' | 'circular' | 'rectangular' | 'rounded'
  width?: string | number
  height?: string | number
  animate?: boolean
  animationType?: 'pulse' | 'shimmer' | 'wave' | 'none'
  style?: React.CSSProperties
}

// Premium gradient shimmer animation
const shimmerKeyframes = {
  opacity: [0.4, 0.8, 0.4],
  x: [-100, 100, -100],
}

const shimmerTransition: { duration: number; repeat: number; ease: Easing } = {
  duration: 2,
  repeat: Infinity,
  ease: 'linear',
}

// Enhanced pulse with scale
const pulseKeyframes = {
  opacity: [0.5, 0.9, 0.5],
  scale: [0.98, 1.02, 0.98],
}

const pulseTransition: { duration: number; repeat: number; ease: Easing } = {
  duration: 1.8,
  repeat: Infinity,
  ease: 'easeInOut',
}

// Wave animation for text
const waveKeyframes = {
  opacity: [0.4, 0.7, 0.4, 0.7, 0.4],
}

const waveTransition: { duration: number; repeat: number; ease: Easing } = {
  duration: 2.5,
  repeat: Infinity,
  ease: 'easeInOut',
}

export const Skeleton: React.FC<SkeletonProps> = ({
  className = '',
  variant = 'text',
  width,
  height,
  animate = true,
  animationType = 'shimmer'
}) => {
  const baseClasses = 'relative overflow-hidden'

  const variantClasses = {
    text: 'rounded',
    circular: 'rounded-full',
    rectangular: '',
    rounded: 'rounded-xl'
  }

  const style: React.CSSProperties = {
    width: width || '100%',
    height: height || (variant === 'text' ? '1em' : '100%'),
  }

  // Create gradient overlay for shimmer effect
  const ShimmerOverlay = () => (
    <motion.div
      className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent"
      animate={{
        x: ['-100%', '100%', '-100%'],
      }}
      transition={shimmerTransition}
      style={{ width: '50%' }}
    />
  )

  // Create animated content
  const AnimatedContent = ({ children }: { children?: React.ReactNode }) => {
    if (!animate) {
      return (
        <div className={`bg-surface-200 dark:bg-surface-700 ${variantClasses[variant]} ${className}`} style={style}>
          {children}
        </div>
      )
    }

    switch (animationType) {
      case 'pulse':
        return (
          <motion.div
            className={`bg-surface-200 dark:bg-surface-700 ${variantClasses[variant]} ${className}`}
            style={style}
            animate={pulseKeyframes}
            transition={pulseTransition}
          >
            {children}
          </motion.div>
        )

      case 'wave':
        return (
          <motion.div
            className={`bg-surface-200 dark:bg-surface-700 ${variantClasses[variant]} ${className}`}
            style={style}
            animate={waveKeyframes}
            transition={waveTransition}
          >
            {children}
          </motion.div>
        )

      case 'shimmer':
      default:
        return (
          <motion.div
            className={`relative bg-surface-200 dark:bg-surface-700 ${variantClasses[variant]} ${className}`}
            style={style}
            animate={{ opacity: [0.5, 0.85, 0.5] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
          >
            <ShimmerOverlay />
          </motion.div>
        )
    }
  }

  return <AnimatedContent />
}

// Specific skeleton components for common patterns
export const CardSkeleton: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`card ${className}`}>
    <div className="flex items-start gap-4">
      <Skeleton variant="circular" width={48} height={48} />
      <div className="flex-1 space-y-2">
        <Skeleton variant="text" width="60%" height={20} />
        <Skeleton variant="text" width="40%" height={16} />
      </div>
    </div>
    <div className="mt-4 space-y-2">
      <Skeleton variant="text" width="100%" height={12} />
      <Skeleton variant="text" width="80%" height={12} />
    </div>
  </div>
)

export const TableRowSkeleton: React.FC<{ columns?: number }> = ({ columns = 5 }) => (
  <tr className="border-b border-surface-100 dark:border-surface-800">
    {Array.from({ length: columns }).map((_, i) => (
      <td key={i} className="py-3 px-2">
        <Skeleton variant="text" height={16} />
      </td>
    ))}
  </tr>
)

export const OrderCardSkeleton: React.FC = () => (
  <div className="card">
    <div className="flex items-start justify-between mb-3">
      <div className="flex-1 space-y-2">
        <Skeleton variant="text" width="50%" height={18} />
        <Skeleton variant="text" width="30%" height={12} />
      </div>
      <Skeleton variant="rounded" width={60} height={24} />
    </div>
    <div className="grid grid-cols-2 gap-3 mb-3">
      <div className="space-y-1">
        <Skeleton variant="text" width="40%" height={10} />
        <Skeleton variant="text" width="70%" height={14} />
      </div>
      <div className="space-y-1">
        <Skeleton variant="text" width="40%" height={10} />
        <Skeleton variant="text" width="60%" height={14} />
      </div>
      <div className="space-y-1">
        <Skeleton variant="text" width="40%" height={10} />
        <Skeleton variant="text" width="50%" height={14} />
      </div>
      <div className="space-y-1">
        <Skeleton variant="text" width="40%" height={10} />
        <Skeleton variant="text" width="60%" height={14} />
      </div>
    </div>
    <div className="pt-3 border-t border-surface-200 dark:border-surface-700">
      <Skeleton variant="rounded" width="100%" height={44} />
    </div>
  </div>
)

export const StaffCardSkeleton: React.FC = () => (
  <div className="card">
    <div className="flex items-start justify-between mb-4">
      <div className="flex items-center gap-3">
        <Skeleton variant="circular" width={48} height={48} />
        <div className="space-y-2">
          <Skeleton variant="text" width={120} height={16} />
          <Skeleton variant="text" width={80} height={14} />
        </div>
      </div>
      <Skeleton variant="rounded" width={60} height={24} />
    </div>
    <div className="space-y-3">
      <Skeleton variant="text" width="100%" height={12} />
      <Skeleton variant="text" width="90%" height={12} />
      <div className="flex items-center justify-between pt-2 border-t border-surface-200 dark:border-surface-700">
        <Skeleton variant="text" width="40%" height={12} />
        <Skeleton variant="text" width="30%" height={12} />
      </div>
    </div>
  </div>
)

export const InventoryCardSkeleton: React.FC = () => (
  <div className="card">
    <div className="flex items-start justify-between mb-3">
      <div className="flex-1 space-y-2">
        <Skeleton variant="text" width="60%" height={16} />
        <Skeleton variant="text" width="40%" height={12} />
      </div>
      <Skeleton variant="rounded" width={50} height={20} />
    </div>
    <div className="grid grid-cols-2 gap-3 mb-3">
      <div className="space-y-1">
        <Skeleton variant="text" width="50%" height={10} />
        <Skeleton variant="text" width="80%" height={14} />
      </div>
      <div className="space-y-1">
        <Skeleton variant="text" width="60%" height={10} />
        <Skeleton variant="text" width="70%" height={14} />
      </div>
      <div className="col-span-2 space-y-1">
        <Skeleton variant="text" width="70%" height={10} />
        <Skeleton variant="text" width="80%" height={14} />
      </div>
    </div>
    <div className="pt-3 border-t border-surface-200 dark:border-surface-700">
      <div className="flex gap-2">
        <Skeleton variant="rounded" className="flex-1" height={44} />
        <Skeleton variant="rounded" width={44} height={44} />
        <Skeleton variant="rounded" width={44} height={44} />
      </div>
    </div>
  </div>
)

export const StatCardSkeleton: React.FC = () => (
  <div className="card">
    <div className="flex items-center justify-between">
      <div className="flex-1 space-y-2">
        <Skeleton variant="text" width="50%" height={12} />
        <Skeleton variant="text" width="40%" height={28} />
      </div>
      <Skeleton variant="rounded" width={48} height={48} />
    </div>
  </div>
)

export const MenuItemSkeleton: React.FC = () => (
  <div className="card">
    <div className="flex items-start gap-4">
      <Skeleton variant="rounded" width={80} height={80} />
      <div className="flex-1 space-y-2">
        <Skeleton variant="text" width="70%" height={18} />
        <Skeleton variant="text" width="50%" height={14} />
        <Skeleton variant="text" width="30%" height={16} />
      </div>
    </div>
    <div className="mt-3 pt-3 border-t border-surface-200 dark:border-surface-700 flex gap-2">
      <Skeleton variant="rounded" width={80} height={32} />
      <Skeleton variant="rounded" width={80} height={32} />
      <Skeleton variant="rounded" width={80} height={32} />
    </div>
  </div>
)

export const TaskSkeleton: React.FC = () => (
  <div className="card">
    <div className="flex items-start justify-between mb-3">
      <div className="flex-1 space-y-2">
        <Skeleton variant="text" width="60%" height={18} />
        <Skeleton variant="text" width="80%" height={14} />
      </div>
      <Skeleton variant="rounded" width={70} height={24} />
    </div>
    <div className="flex items-center gap-3 mt-3 pt-3 border-t border-surface-200 dark:border-surface-700">
      <Skeleton variant="circular" width={24} height={24} />
      <Skeleton variant="text" width="30%" height={12} />
      <Skeleton variant="text" width="25%" height={12} />
    </div>
  </div>
)

export const MessageSkeleton: React.FC = () => (
  <div className="flex gap-3 mb-4">
    <Skeleton variant="circular" width={40} height={40} />
    <div className="flex-1 space-y-2">
      <div className="flex items-center gap-2">
        <Skeleton variant="text" width="30%" height={14} />
        <Skeleton variant="text" width="20%" height={12} />
      </div>
      <Skeleton variant="rounded" width="80%" height={60} />
    </div>
  </div>
)

// Voice Chat / Mobile Skeleton - for mobile voice interface
export const VoiceChatSkeleton: React.FC = () => (
  <div className="card p-6">
    <div className="flex flex-col items-center">
      {/* Animated pulsing circle for voice */}
      <div className="relative mb-8">
        <Skeleton
          variant="circular"
          width={120}
          height={120}
          animationType="pulse"
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <Skeleton variant="circular" width={80} height={80} animationType="wave" />
        </div>
      </div>

      {/* Status text */}
      <div className="space-y-3 text-center w-full max-w-xs">
        <Skeleton variant="text" width="60%" height={20} className="mx-auto" />
        <Skeleton variant="text" width="80%" height={14} className="mx-auto" />
      </div>

      {/* Waveform placeholder */}
      <div className="flex items-center justify-center gap-1 mt-8 h-12 w-full">
        {[...Array(7)].map((_, i) => (
          <Skeleton
            key={i}
            variant="rounded"
            width={6}
            height={Math.random() * 40 + 20}
            animationType="wave"
            style={{ animationDelay: `${i * 0.1}s` }}
          />
        ))}
      </div>

      {/* Control buttons */}
      <div className="flex gap-4 mt-8">
        <Skeleton variant="circular" width={56} height={56} animationType="pulse" />
        <Skeleton variant="circular" width={72} height={72} animationType="pulse" />
        <Skeleton variant="circular" width={56} height={56} animationType="pulse" />
      </div>
    </div>
  </div>
)

// Tablet Order Card Skeleton - for kitchen tablet view
export const TabletOrderSkeleton: React.FC = () => (
  <div className="card p-4 border-l-4 border-l-teal-500">
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-3">
        <Skeleton variant="rounded" width={48} height={48} animationType="pulse" />
        <div className="space-y-1">
          <Skeleton variant="text" width={100} height={18} />
          <Skeleton variant="text" width={60} height={12} />
        </div>
      </div>
      <Skeleton variant="rounded" width={80} height={32} animationType="pulse" />
    </div>

    {/* Order items */}
    <div className="space-y-2 mb-4">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="flex items-center gap-2">
          <Skeleton variant="text" width={24} height={16} />
          <Skeleton variant="text" width="60%" height={14} />
        </div>
      ))}
    </div>

    {/* Order time indicator */}
    <div className="flex items-center justify-between pt-3 border-t border-surface-200 dark:border-surface-700">
      <Skeleton variant="text" width={80} height={12} />
      <Skeleton variant="rounded" width={100} height={28} />
    </div>
  </div>
)

// Dashboard Stats Grid Skeleton
export const DashboardStatsSkeleton: React.FC = () => (
  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
    {[...Array(4)].map((_, i) => (
      <div key={i} className="card p-4">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton variant="text" width="70%" height={12} />
            <Skeleton variant="text" width="50%" height={28} />
          </div>
          <Skeleton variant="rounded" width={40} height={40} animationType="pulse" />
        </div>
      </div>
    ))}
  </div>
)

// Full Page Loading Skeleton - for complete page loading states
export const FullPageSkeleton: React.FC<{ header?: boolean; sidebar?: boolean }> = ({
  header = true,
  sidebar = false
}) => (
  <div className="animate-pulse">
    {header && (
      <div className="h-16 border-b border-surface-200 dark:border-surface-700 flex items-center px-6 mb-6">
        <Skeleton variant="text" width={150} height={24} />
      </div>
    )}

    <div className="flex gap-6 px-6">
      {sidebar && (
        <div className="w-64 hidden lg:block">
          <div className="space-y-4">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} variant="rounded" height={40} />
            ))}
          </div>
        </div>
      )}

      <div className="flex-1 space-y-6">
        <DashboardStatsSkeleton />

        <div className="space-y-4">
          <Skeleton variant="text" width={200} height={20} />
          {[...Array(3)].map((_, i) => (
            <OrderCardSkeleton key={i} />
          ))}
        </div>
      </div>
    </div>
  </div>
)

// Compact Skeleton Row - for lists
export const CompactRowSkeleton: React.FC<{ avatar?: boolean; action?: boolean }> = ({
  avatar = true,
  action = true
}) => (
  <div className="flex items-center gap-4 py-3 border-b border-surface-100 dark:border-surface-800">
    {avatar && <Skeleton variant="circular" width={40} height={40} />}
    <div className="flex-1 space-y-1">
      <Skeleton variant="text" width="60%" height={14} />
      <Skeleton variant="text" width="40%" height={12} />
    </div>
    {action && <Skeleton variant="rounded" width={60} height={28} />}
  </div>
)
