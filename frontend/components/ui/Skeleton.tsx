import React from 'react'
import { motion } from 'framer-motion'

interface SkeletonProps {
  className?: string
  variant?: 'text' | 'circular' | 'rectangular' | 'rounded'
  width?: string | number
  height?: string | number
  animate?: boolean
}

export const Skeleton: React.FC<SkeletonProps> = ({
  className = '',
  variant = 'text',
  width,
  height,
  animate = true
}) => {
  const baseClasses = 'bg-surface-200 dark:bg-surface-700'

  const variantClasses = {
    text: 'rounded',
    circular: 'rounded-full',
    rectangular: '',
    rounded: 'rounded-xl'
  }

  const style: React.CSSProperties = {
    width: width || '100%',
    height: height || (variant === 'text' ? '1em' : '100%')
  }

  if (animate) {
    return (
      <motion.div
        className={`${baseClasses} ${variantClasses[variant]} ${className}`}
        style={style}
        animate={{
          opacity: [0.5, 0.8, 0.5]
        }}
        transition={{
          duration: 1.5,
          repeat: Infinity,
          ease: 'easeInOut'
        }}
      />
    )
  }

  return (
    <div
      className={`${baseClasses} ${variantClasses[variant]} ${className} animate-pulse`}
      style={style}
    />
  )
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
