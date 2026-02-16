import React, { useState, useMemo } from 'react'
import { motion, AnimatePresence, type Variants } from 'framer-motion'
import { 
  Grid3X3, 
  List, 
  Plus, 
  MapPin, 
  Phone, 
  Clock, 
  TrendingUp, 
  Users,
  ShoppingBag,
  Store,
  MoreVertical
} from 'lucide-react'
import { Button } from '../ui/Button'
import { Skeleton } from '../ui/Skeleton'
import { OptimizedImage } from '../ui/OptimizedImage'

// Types
export interface Restaurant {
  id: string
  name: string
  slug: string
  logo_url?: string
  address?: string
  phone?: string
  is_active?: boolean
  created_at?: string
  metrics?: {
    activeOrders?: number
    todayRevenue?: number
    todayOrders?: number
    staffOnDuty?: number
    avgOrderValue?: number
  }
}

export interface RestaurantGridProps {
  restaurants: Restaurant[]
  onRestaurantSelect: (id: string) => void
  onAddRestaurant: () => void
  loading?: boolean
  viewMode?: 'grid' | 'list'
  sortBy?: 'name' | 'revenue' | 'orders' | 'created'
  onViewModeChange?: (mode: 'grid' | 'list') => void
  onSortByChange?: (sort: string) => void
}

// Format currency
const formatCurrency = (value?: number): string => {
  if (value === undefined || value === null) return '$0.00'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

// Format date
const formatDate = (dateString?: string): string => {
  if (!dateString) return 'N/A'
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

// Sort options configuration
const SORT_OPTIONS = [
  { value: 'name', label: 'Name' },
  { value: 'revenue', label: 'Revenue' },
  { value: 'orders', label: 'Orders' },
  { value: 'created', label: 'Created' },
] as const

// View toggle button
const ViewToggleButton: React.FC<{
  active: boolean
  icon: React.ElementType
  label: string
  onClick: () => void
}> = ({ active, icon: Icon, label, onClick }) => (
  <motion.button
    whileHover={{ scale: 1.05 }}
    whileTap={{ scale: 0.95 }}
    onClick={onClick}
    className={`
      p-2.5 rounded-xl transition-all duration-200
      ${active 
        ? 'bg-primary-500 text-white shadow-lg shadow-primary-500/25' 
        : 'bg-surface-100 dark:bg-surface-700 text-surface-600 dark:text-surface-400 hover:bg-surface-200 dark:hover:bg-surface-600'
      }
    `}
    aria-label={label}
    aria-pressed={active}
  >
    <Icon className="w-5 h-5" />
  </motion.button>
)

// Loading skeleton for restaurant card
const RestaurantCardSkeleton: React.FC<{ viewMode: 'grid' | 'list' }> = ({ viewMode }) => (
  <div className={`
    ${viewMode === 'grid' 
      ? 'bg-white dark:bg-surface-800 rounded-3xl p-6' 
      : 'bg-white dark:bg-surface-800 rounded-2xl p-4'
    }
  `}>
    <div className="flex items-start gap-4">
      <Skeleton 
        variant="rounded" 
        width={viewMode === 'grid' ? 80 : 60} 
        height={viewMode === 'grid' ? 80 : 60} 
        className="flex-shrink-0"
      />
      <div className="flex-1 space-y-3">
        <Skeleton variant="text" width="60%" height={24} />
        <Skeleton variant="text" width="80%" height={16} />
        <div className="flex gap-4 pt-2">
          <Skeleton variant="text" width={60} height={14} />
          <Skeleton variant="text" width={60} height={14} />
          <Skeleton variant="text" width={60} height={14} />
        </div>
      </div>
    </div>
  </div>
)

// Restaurant card component
const RestaurantCard: React.FC<{
  restaurant: Restaurant
  viewMode: 'grid' | 'list'
  onSelect: (id: string) => void
  index: number
}> = ({ restaurant, viewMode, onSelect, index }) => {
  const [imageError, setImageError] = useState(false)

  const cardVariants: Variants = {
    hidden: { opacity: 0, y: 20 },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: { 
        delay: index * 0.05,
        duration: 0.3,
        ease: 'easeOut'
      }
    },
    exit: { opacity: 0, scale: 0.95 },
    hover: { 
      y: -4,
      transition: { duration: 0.2 }
    }
  }

  if (viewMode === 'list') {
    return (
      <motion.div
        variants={cardVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
        whileHover="hover"
        onClick={() => onSelect(restaurant.id)}
        className="group bg-white dark:bg-surface-800 rounded-2xl p-4 shadow-sm hover:shadow-xl cursor-pointer transition-all duration-200 border border-transparent hover:border-primary-500/20"
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && onSelect(restaurant.id)}
        aria-label={`Select ${restaurant.name}`}
      >
        <div className="flex items-center gap-4">
          {/* Logo */}
          <div className="relative w-14 h-14 rounded-2xl overflow-hidden bg-surface-100 dark:bg-surface-700 flex-shrink-0">
            {restaurant.logo_url && !imageError ? (
              <OptimizedImage
                src={restaurant.logo_url}
                alt={restaurant.name}
                fill
                objectFit="cover"
                onError={() => setImageError(true)}
                fallbackSrc="/images/placeholder.png"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Store className="w-6 h-6 text-surface-400" />
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-surface-900 dark:text-surface-100 truncate">
                {restaurant.name}
              </h3>
              <span className={`
                w-2 h-2 rounded-full flex-shrink-0
                ${restaurant.is_active 
                  ? 'bg-servio-green-500 shadow-lg shadow-servio-green-500/50' 
                  : 'bg-surface-400'
                }
              `} />
            </div>
            {restaurant.address && (
              <p className="text-sm text-surface-500 dark:text-surface-400 truncate flex items-center gap-1 mt-0.5">
                <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                {restaurant.address}
              </p>
            )}
          </div>

          {/* Metrics */}
          <div className="hidden md:flex items-center gap-6">
            <div className="text-center">
              <p className="text-lg font-bold text-surface-900 dark:text-surface-100">
                {restaurant.metrics?.activeOrders ?? 0}
              </p>
              <p className="text-xs text-surface-500">Orders</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-surface-900 dark:text-surface-100">
                {formatCurrency(restaurant.metrics?.todayRevenue)}
              </p>
              <p className="text-xs text-surface-500">Revenue</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-surface-900 dark:text-surface-100">
                {restaurant.metrics?.staffOnDuty ?? 0}
              </p>
              <p className="text-xs text-surface-500">Staff</p>
            </div>
          </div>

          {/* More button */}
          <button 
            className="p-2 rounded-xl hover:bg-surface-100 dark:hover:bg-surface-700 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={(e) => {
              e.stopPropagation()
              onSelect(restaurant.id)
            }}
          >
            <MoreVertical className="w-5 h-5 text-surface-400" />
          </button>
        </div>
      </motion.div>
    )
  }

  // Grid view
  return (
    <motion.div
      variants={cardVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      whileHover="hover"
      onClick={() => onSelect(restaurant.id)}
      className="group bg-white dark:bg-surface-800 rounded-3xl p-6 shadow-sm hover:shadow-xl cursor-pointer transition-all duration-200 border border-transparent hover:border-primary-500/20"
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onSelect(restaurant.id)}
      aria-label={`Select ${restaurant.name}`}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          {/* Logo */}
          <div className="relative w-16 h-16 rounded-2xl overflow-hidden bg-surface-100 dark:bg-surface-700">
            {restaurant.logo_url && !imageError ? (
              <OptimizedImage
                src={restaurant.logo_url}
                alt={restaurant.name}
                fill
                objectFit="cover"
                onError={() => setImageError(true)}
                fallbackSrc="/images/placeholder.png"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Store className="w-7 h-7 text-surface-400" />
              </div>
            )}
          </div>
          <div>
            <h3 className="font-bold text-lg text-surface-900 dark:text-surface-100 line-clamp-1">
              {restaurant.name}
            </h3>
            <span className={`
              inline-flex items-center gap-1.5 text-xs font-medium
              ${restaurant.is_active 
                ? 'text-servio-green-600 dark:text-servio-green-400' 
                : 'text-surface-500'
              }
            `}>
              <span className={`
                w-2 h-2 rounded-full
                ${restaurant.is_active 
                  ? 'bg-servio-green-500 shadow-lg shadow-servio-green-500/50' 
                  : 'bg-surface-400'
                }
              `} />
              {restaurant.is_active ? 'Active' : 'Inactive'}
            </span>
          </div>
        </div>
        <button 
          className="p-2 rounded-xl hover:bg-surface-100 dark:hover:bg-surface-700 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={(e) => {
            e.stopPropagation()
            onSelect(restaurant.id)
          }}
        >
          <MoreVertical className="w-5 h-5 text-surface-400" />
        </button>
      </div>

      {/* Address */}
      {restaurant.address && (
        <p className="text-sm text-surface-500 dark:text-surface-400 flex items-start gap-2 mb-4 line-clamp-2">
          <MapPin className="w-4 h-4 flex-shrink-0 mt-0.5" />
          {restaurant.address}
        </p>
      )}

      {/* Phone */}
      {restaurant.phone && (
        <p className="text-sm text-surface-500 dark:text-surface-400 flex items-center gap-2 mb-4">
          <Phone className="w-4 h-4 flex-shrink-0" />
          {restaurant.phone}
        </p>
      )}

      {/* Metrics */}
      <div className="grid grid-cols-3 gap-3 pt-4 border-t border-surface-100 dark:border-surface-700">
        <div className="text-center p-2 rounded-xl bg-surface-50 dark:bg-surface-700/50">
          <div className="flex items-center justify-center gap-1 mb-1">
            <ShoppingBag className="w-3.5 h-3.5 text-primary-500" />
            <span className="text-lg font-bold text-surface-900 dark:text-surface-100">
              {restaurant.metrics?.activeOrders ?? 0}
            </span>
          </div>
          <p className="text-xs text-surface-500">Active Orders</p>
        </div>
        <div className="text-center p-2 rounded-xl bg-surface-50 dark:bg-surface-700/50">
          <div className="flex items-center justify-center gap-1 mb-1">
            <TrendingUp className="w-3.5 h-3.5 text-servio-green-500" />
            <span className="text-lg font-bold text-surface-900 dark:text-surface-100">
              {formatCurrency(restaurant.metrics?.todayRevenue)}
            </span>
          </div>
          <p className="text-xs text-surface-500">Today</p>
        </div>
        <div className="text-center p-2 rounded-xl bg-surface-50 dark:bg-surface-700/50">
          <div className="flex items-center justify-center gap-1 mb-1">
            <Users className="w-3.5 h-3.5 text-servio-orange-500" />
            <span className="text-lg font-bold text-surface-900 dark:text-surface-100">
              {restaurant.metrics?.staffOnDuty ?? 0}
            </span>
          </div>
          <p className="text-xs text-surface-500">Staff</p>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between mt-4 pt-3 border-t border-surface-100 dark:border-surface-700">
        <div className="flex items-center gap-1.5 text-xs text-surface-500">
          <Clock className="w-3.5 h-3.5" />
          <span>Created {formatDate(restaurant.created_at)}</span>
        </div>
      </div>
    </motion.div>
  )
}

// Add restaurant card
const AddRestaurantCard: React.FC<{ onClick: () => void }> = ({ onClick }) => (
  <motion.div
    initial={{ opacity: 0, scale: 0.95 }}
    animate={{ opacity: 1, scale: 1 }}
    whileHover={{ scale: 1.02 }}
    whileTap={{ scale: 0.98 }}
    onClick={onClick}
    className="group bg-gradient-to-br from-primary-50 to-primary-100 dark:from-primary-900/20 dark:to-surface-800 rounded-3xl p-6 cursor-pointer border-2 border-dashed border-primary-300 dark:border-primary-700 hover:border-primary-500 transition-all duration-200 flex flex-col items-center justify-center min-h-[320px]"
    role="button"
    tabIndex={0}
    onKeyDown={(e) => e.key === 'Enter' && onClick()}
    aria-label="Add new restaurant"
  >
    <motion.div
      className="w-20 h-20 rounded-3xl bg-primary-500 text-white flex items-center justify-center shadow-lg shadow-primary-500/30 mb-4"
      whileHover={{ rotate: 90 }}
      transition={{ duration: 0.3 }}
    >
      <Plus className="w-10 h-10" />
    </motion.div>
    <h3 className="text-lg font-bold text-primary-700 dark:text-primary-300 mb-2">
      Add Restaurant
    </h3>
    <p className="text-sm text-primary-600 dark:text-primary-400 text-center max-w-[200px]">
      Register a new restaurant to manage menus, orders, and staff
    </p>
  </motion.div>
)

// Empty state component
const EmptyState: React.FC<{ onAddRestaurant: () => void }> = ({ onAddRestaurant }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    className="col-span-full py-16"
  >
    <div className="text-center">
      <motion.div
        initial={{ scale: 0.9 }}
        animate={{ scale: 1 }}
        transition={{ delay: 0.1, type: 'spring', stiffness: 200 }}
        className="w-24 h-24 mx-auto mb-6 bg-gradient-to-br from-surface-100 to-surface-200 dark:from-surface-700 dark:to-surface-800 rounded-3xl flex items-center justify-center"
      >
        <Store className="w-12 h-12 text-surface-400" />
      </motion.div>
      <h3 className="text-2xl font-bold text-surface-900 dark:text-surface-100 mb-3">
        No Restaurants Yet
      </h3>
      <p className="text-surface-600 dark:text-surface-400 mb-8 max-w-md mx-auto">
        Get started by adding your first restaurant. You'll be able to manage menus, orders, and staff all in one place.
      </p>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <Button
          variant="primary"
          size="lg"
          icon={Plus}
          onClick={onAddRestaurant}
          className="mx-auto"
        >
          Add Your First Restaurant
        </Button>
      </motion.div>
    </div>
  </motion.div>
)

// Loading skeleton grid
const LoadingSkeleton: React.FC<{ viewMode: 'grid' | 'list' }> = ({ viewMode }) => (
  <div className={viewMode === 'grid' 
    ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'
    : 'space-y-4'
  }>
    {[...Array(6)].map((_, i) => (
      <RestaurantCardSkeleton key={i} viewMode={viewMode} />
    ))}
  </div>
)

// Main component
export const RestaurantGrid: React.FC<RestaurantGridProps> = ({
  restaurants,
  onRestaurantSelect,
  onAddRestaurant,
  loading = false,
  viewMode: controlledViewMode,
  sortBy: controlledSortBy,
  onViewModeChange,
  onSortByChange,
}) => {
  const [internalViewMode, setInternalViewMode] = useState<'grid' | 'list'>('grid')
  const [internalSortBy, setInternalSortBy] = useState<'name' | 'revenue' | 'orders' | 'created'>('name')

  // Use controlled props if provided, otherwise use internal state
  const viewMode = controlledViewMode ?? internalViewMode
  const sortBy = controlledSortBy ?? internalSortBy

  const handleViewModeChange = (mode: 'grid' | 'list') => {
    if (onViewModeChange) {
      onViewModeChange(mode)
    } else {
      setInternalViewMode(mode)
    }
  }

  const handleSortByChange = (sort: 'name' | 'revenue' | 'orders' | 'created') => {
    if (onSortByChange) {
      onSortByChange(sort)
    } else {
      setInternalSortBy(sort)
    }
  }

  // Sort restaurants
  const sortedRestaurants = useMemo(() => {
    const sorted = [...restaurants]
    switch (sortBy) {
      case 'name':
        return sorted.sort((a, b) => a.name.localeCompare(b.name))
      case 'revenue':
        return sorted.sort((a, b) => (b.metrics?.todayRevenue ?? 0) - (a.metrics?.todayRevenue ?? 0))
      case 'orders':
        return sorted.sort((a, b) => (b.metrics?.todayOrders ?? 0) - (a.metrics?.todayOrders ?? 0))
      case 'created':
        return sorted.sort((a, b) => {
          if (!a.created_at) return 1
          if (!b.created_at) return -1
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        })
      default:
        return sorted
    }
  }, [restaurants, sortBy])

  return (
    <div className="space-y-6">
      {/* View Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        {/* Sort Dropdown */}
        <div className="flex items-center gap-3">
          <label htmlFor="sort-select" className="text-sm font-medium text-surface-600 dark:text-surface-400">
            Sort by:
          </label>
          <div className="relative">
            <select
              id="sort-select"
              value={sortBy}
              onChange={(e) => handleSortByChange(e.target.value as 'name' | 'revenue' | 'orders' | 'created')}
              className="appearance-none bg-surface-100 dark:bg-surface-700 border-0 text-surface-900 dark:text-surface-100 text-sm font-medium rounded-xl px-4 py-2.5 pr-10 cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
              <svg className="w-4 h-4 text-surface-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
        </div>

        {/* View Toggle */}
        <div className="flex items-center gap-2 bg-surface-100 dark:bg-surface-700 p-1.5 rounded-xl">
          <ViewToggleButton
            active={viewMode === 'grid'}
            icon={Grid3X3}
            label="Grid view"
            onClick={() => handleViewModeChange('grid')}
          />
          <ViewToggleButton
            active={viewMode === 'list'}
            icon={List}
            label="List view"
            onClick={() => handleViewModeChange('list')}
          />
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <LoadingSkeleton viewMode={viewMode} />
      ) : (
        <div className={viewMode === 'grid' 
          ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'
          : 'space-y-4'
        }>
          <AnimatePresence mode="popLayout">
            {sortedRestaurants.map((restaurant, index) => (
              <RestaurantCard
                key={restaurant.id}
                restaurant={restaurant}
                viewMode={viewMode}
                onSelect={onRestaurantSelect}
                index={index}
              />
            ))}
            
            {/* Add Restaurant Card - Only show in grid view or when there are restaurants */}
            {viewMode === 'grid' && (
              <AddRestaurantCard onClick={onAddRestaurant} />
            )}
          </AnimatePresence>

          {/* Empty state */}
          {restaurants.length === 0 && (
            <EmptyState onAddRestaurant={onAddRestaurant} />
          )}
        </div>
      )}

      {/* Add button for list view */}
      {viewMode === 'list' && !loading && restaurants.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex justify-center pt-4"
        >
          <Button
            variant="outline"
            size="lg"
            icon={Plus}
            onClick={onAddRestaurant}
            className="border-2 border-dashed"
          >
            Add New Restaurant
          </Button>
        </motion.div>
      )}
    </div>
  )
}

export default RestaurantGrid
