import React, { useState, useRef, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ChevronDown,
  Search,
  Store,
  Grid,
  Settings,
  DollarSign,
  Users,
  ShoppingBag,
  Check,
  X
} from 'lucide-react'

// ============================================================================
// Types
// ============================================================================

export interface Restaurant {
  id: string
  name: string
  slug: string
  logo_url?: string
  is_active?: boolean
  metrics?: {
    activeOrders?: number
    todayRevenue?: number
    staffOnDuty?: number
  }
}

export interface RestaurantSwitcherProps {
  currentRestaurant?: {
    id: string
    name: string
    logo_url?: string
  }
  restaurants: Restaurant[]
  onSwitch: (restaurantId: string) => void
  showAllOption?: boolean
  allOptionLabel?: string
  searchEnabled?: boolean
  groupByRegion?: boolean
  className?: string
}

// ============================================================================
// Utility Components
// ============================================================================

const StatusDot: React.FC<{ isActive?: boolean }> = ({ isActive }) => (
  <span
    className={`w-2 h-2 rounded-full flex-shrink-0 ${
      isActive
        ? 'bg-green-500'
        : 'bg-surface-300 dark:bg-surface-600'
    }`}
  />
)

const RestaurantLogo: React.FC<{ logo_url?: string; name: string; size?: 'sm' | 'md' | 'lg' }> = ({
  logo_url,
  name,
  size = 'md'
}) => {
  const sizeClasses = {
    sm: 'w-6 h-6',
    md: 'w-8 h-8',
    lg: 'w-10 h-10'
  }

  if (logo_url) {
    return (
      <img
        src={logo_url}
        alt={name}
        className={`${sizeClasses[size]} rounded-lg object-cover bg-surface-100 dark:bg-surface-700`}
      />
    )
  }

  return (
    <div
      className={`${sizeClasses[size]} rounded-lg bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center`}
    >
      <Store className="w-4 h-4 text-primary-600 dark:text-primary-400" />
    </div>
  )
}

// ============================================================================
// Restaurant List Item Component
// ============================================================================

const RestaurantListItem: React.FC<{
  restaurant: Restaurant
  isActive: boolean
  isSelected: boolean
  onClick: () => void
  searchQuery?: string
}> = ({ restaurant, isActive, isSelected, onClick, searchQuery }) => {
  const highlightText = (text: string, query: string) => {
    if (!query) return text
    const parts = text.split(new RegExp(`(${query})`, 'gi'))
    return parts.map((part, i) =>
      part.toLowerCase() === query.toLowerCase() ? (
        <span key={i} className="bg-yellow-200 dark:bg-yellow-800 font-medium">
          {part}
        </span>
      ) : (
        part
      )
    )
  }

  return (
    <motion.button
      onClick={onClick}
      className={`w-full flex items-center gap-3 p-3 rounded-lg text-left transition-all duration-200 ${
        isSelected
          ? 'bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800'
          : 'hover:bg-surface-50 dark:hover:bg-surface-700'
      }`}
      whileTap={{ scale: 0.98 }}
    >
      <RestaurantLogo logo_url={restaurant.logo_url} name={restaurant.name} size="md" />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-surface-900 dark:text-surface-100 truncate">
            {highlightText(restaurant.name, searchQuery || '')}
          </span>
          <StatusDot isActive={restaurant.is_active ?? isActive} />
          {isSelected && (
            <Check className="w-4 h-4 text-primary-500 flex-shrink-0 ml-auto" />
          )}
        </div>

        {restaurant.metrics && (
          <div className="flex items-center gap-3 mt-1.5 text-xs text-surface-500 dark:text-surface-400">
            {restaurant.metrics.activeOrders !== undefined && (
              <span className="flex items-center gap-1">
                <ShoppingBag className="w-3 h-3" />
                {restaurant.metrics.activeOrders} orders
              </span>
            )}
            {restaurant.metrics.todayRevenue !== undefined && (
              <span className="flex items-center gap-1">
                <DollarSign className="w-3 h-3" />
                ${restaurant.metrics.todayRevenue.toLocaleString()}
              </span>
            )}
            {restaurant.metrics.staffOnDuty !== undefined && (
              <span className="flex items-center gap-1">
                <Users className="w-3 h-3" />
                {restaurant.metrics.staffOnDuty} staff
              </span>
            )}
          </div>
        )}
      </div>
    </motion.button>
  )
}

// ============================================================================
// Mobile Bottom Sheet Component
// ============================================================================

const MobileBottomSheet: React.FC<{
  isOpen: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
}> = ({ isOpen, onClose, title, children }) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50"
            onClick={onClose}
          />

          {/* Bottom Sheet */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 bg-white dark:bg-surface-800 rounded-t-2xl z-50 max-h-[85vh] flex flex-col"
          >
            {/* Handle */}
            <div className="flex justify-center py-3">
              <div className="w-12 h-1.5 bg-surface-200 dark:bg-surface-700 rounded-full" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-4 pb-3 border-b border-surface-200 dark:border-surface-700">
              <h2 className="text-lg font-semibold text-surface-900 dark:text-surface-100">
                {title}
              </h2>
              <button
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-700 transition-colors"
              >
                <X className="w-5 h-5 text-surface-500" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-4 py-4">{children}</div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

// ============================================================================
// Main Component
// ============================================================================

export const RestaurantSwitcher: React.FC<RestaurantSwitcherProps> = ({
  currentRestaurant,
  restaurants,
  onSwitch,
  showAllOption = false,
  allOptionLabel = 'All Restaurants',
  searchEnabled = true,
  groupByRegion = false,
  className = ''
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(currentRestaurant?.id || null)
  const [focusedIndex, setFocusedIndex] = useState(-1)
  const containerRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768

  // Filter restaurants based on search query
  const filteredRestaurants = useMemo(() => {
    if (!searchQuery) return restaurants
    const query = searchQuery.toLowerCase()
    return restaurants.filter(
      (r) =>
        r.name.toLowerCase().includes(query) ||
        r.slug.toLowerCase().includes(query)
    )
  }, [restaurants, searchQuery])

  // Group restaurants by region if enabled
  const groupedRestaurants = useMemo(() => {
    if (!groupByRegion) return { default: filteredRestaurants }

    return filteredRestaurants.reduce(
      (acc, restaurant) => {
        const region = (restaurant as any).region || 'Other'
        if (!acc[region]) acc[region] = []
        acc[region].push(restaurant)
        return acc
      },
      {} as Record<string, typeof restaurants>
    )
  }, [filteredRestaurants, groupByRegion])

  // Calculate total items for keyboard navigation
  const totalItems = useMemo(() => {
    let count = showAllOption ? 1 : 0
    if (groupByRegion) {
      Object.values(groupedRestaurants).forEach((group) => {
        count += group.length
      })
    } else {
      count += filteredRestaurants.length
    }
    return count
  }, [showAllOption, groupedRestaurants, filteredRestaurants, groupByRegion])

  // Handle click outside to close
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && searchEnabled && searchInputRef.current) {
      setTimeout(() => searchInputRef.current?.focus(), 100)
    }
  }, [isOpen, searchEnabled])

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
        e.preventDefault()
        setIsOpen(true)
      }
      return
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setFocusedIndex((prev) => (prev + 1) % totalItems)
        break
      case 'ArrowUp':
        e.preventDefault()
        setFocusedIndex((prev) => (prev - 1 + totalItems) % totalItems)
        break
      case 'Enter':
        e.preventDefault()
        if (focusedIndex >= 0) {
          handleSelection(focusedIndex)
        }
        break
      case 'Escape':
        e.preventDefault()
        setIsOpen(false)
        setFocusedIndex(-1)
        break
    }
  }

  const handleSelection = (index: number) => {
    let currentIndex = 0

    if (showAllOption) {
      if (index === 0) {
        onSwitch('all')
        setSelectedId('all')
        setIsOpen(false)
        return
      }
      currentIndex = 1
    }

    if (groupByRegion) {
      for (const [, group] of Object.entries(groupedRestaurants)) {
        if (index === currentIndex) {
          // This shouldn't happen with the current logic
          break
        }
        if (index < currentIndex + group.length) {
          const restaurantIndex = index - currentIndex
          const restaurant = group[restaurantIndex]
          onSwitch(restaurant.id)
          setSelectedId(restaurant.id)
          setIsOpen(false)
          return
        }
        currentIndex += group.length
      }
    } else {
      const restaurant = filteredRestaurants[index - currentIndex]
      if (restaurant) {
        onSwitch(restaurant.id)
        setSelectedId(restaurant.id)
        setIsOpen(false)
      }
    }
  }

  // Scroll focused item into view
  useEffect(() => {
    if (focusedIndex >= 0 && listRef.current) {
      const focusedElement = listRef.current.children[focusedIndex] as HTMLElement
      focusedElement?.scrollIntoView({ block: 'nearest' })
    }
  }, [focusedIndex])

  const getItemIndex = (restaurantId: string): number => {
    let index = showAllOption ? 1 : 0

    if (groupByRegion) {
      for (const group of Object.values(groupedRestaurants)) {
        const foundIndex = group.findIndex((r) => r.id === restaurantId)
        if (foundIndex >= 0) {
          return index + foundIndex
        }
        index += group.length
      }
    } else {
      const foundIndex = filteredRestaurants.findIndex((r) => r.id === restaurantId)
      if (foundIndex >= 0) {
        return index + foundIndex
      }
    }

    return -1
  }

  const allOptionIndex = 0
  const currentFocusedIndex = selectedId ? getItemIndex(selectedId) : -1

  // =========================================================================
  // Render
  // =========================================================================

  if (restaurants.length === 0) {
    return null
  }

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Main Toggle Button */}
      <motion.button
        onClick={() => setIsOpen(!isOpen)}
        onKeyDown={handleKeyDown}
        className="flex items-center gap-2 p-2 bg-white dark:bg-surface-800 rounded-lg border border-surface-200 dark:border-surface-700 hover:border-surface-300 dark:hover:border-surface-600 transition-all duration-200 min-h-[44px]"
        whileTap={{ scale: 0.98 }}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-label={currentRestaurant ? `Current restaurant: ${currentRestaurant.name}` : 'Select restaurant'}
      >
        <RestaurantLogo
          logo_url={currentRestaurant?.logo_url}
          name={currentRestaurant?.name || 'Restaurant'}
          size="sm"
        />

        <div className="hidden sm:block text-left min-w-0 flex-1">
          <div className="text-xs text-surface-500 dark:text-surface-400">
            Restaurant
          </div>
          <div className="font-medium text-surface-900 dark:text-surface-100 text-sm truncate">
            {currentRestaurant?.name || allOptionLabel}
          </div>
        </div>

        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="text-surface-400"
        >
          <ChevronDown className="w-4 h-4" />
        </motion.div>
      </motion.button>

      {/* Mobile Bottom Sheet */}
      {isMobile ? (
        <MobileBottomSheet
          isOpen={isOpen}
          onClose={() => setIsOpen(false)}
          title="Select Restaurant"
        >
          {/* Search */}
          {searchEnabled && (
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search restaurants..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-surface-100 dark:bg-surface-700 rounded-lg text-surface-900 dark:text-surface-100 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          )}

          {/* All Option */}
          {showAllOption && (
            <motion.button
              onClick={() => {
                onSwitch('all')
                setSelectedId('all')
                setIsOpen(false)
              }}
              className={`w-full flex items-center gap-3 p-3 rounded-lg mb-3 ${
                selectedId === 'all'
                  ? 'bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800'
                  : 'hover:bg-surface-50 dark:hover:bg-surface-700'
              }`}
              whileTap={{ scale: 0.98 }}
            >
              <div className="w-8 h-8 rounded-lg bg-surface-100 dark:bg-surface-700 flex items-center justify-center">
                <Grid className="w-4 h-4 text-surface-600 dark:text-surface-400" />
              </div>
              <span className="font-medium text-surface-900 dark:text-surface-100">
                {allOptionLabel}
              </span>
              {selectedId === 'all' && (
                <Check className="w-4 h-4 text-primary-500 ml-auto" />
              )}
            </motion.button>
          )}

          {/* Restaurant List */}
          {groupByRegion ? (
            Object.entries(groupedRestaurants).map(([region, group]) => (
              <div key={region} className="mb-4">
                <h3 className="text-xs font-semibold text-surface-500 dark:text-surface-400 uppercase tracking-wide mb-2 px-1">
                  {region}
                </h3>
                <div className="space-y-1">
                  {group.map((restaurant) => (
                    <RestaurantListItem
                      key={restaurant.id}
                      restaurant={restaurant}
                      isActive={restaurant.is_active ?? true}
                      isSelected={selectedId === restaurant.id}
                      onClick={() => {
                        onSwitch(restaurant.id)
                        setSelectedId(restaurant.id)
                        setIsOpen(false)
                      }}
                      searchQuery={searchQuery}
                    />
                  ))}
                </div>
              </div>
            ))
          ) : (
            <div className="space-y-1" ref={listRef}>
              {filteredRestaurants.map((restaurant) => (
                <RestaurantListItem
                  key={restaurant.id}
                  restaurant={restaurant}
                  isActive={restaurant.is_active ?? true}
                  isSelected={selectedId === restaurant.id}
                  onClick={() => {
                    onSwitch(restaurant.id)
                    setSelectedId(restaurant.id)
                    setIsOpen(false)
                  }}
                  searchQuery={searchQuery}
                />
              ))}
            </div>
          )}
        </MobileBottomSheet>
      ) : (
        /* Desktop Dropdown */
        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="absolute top-full right-0 mt-2 w-80 bg-white dark:bg-surface-800 rounded-lg border border-surface-200 dark:border-surface-700 shadow-lg z-50 max-h-96 overflow-hidden flex flex-col"
            >
              {/* Search */}
              {searchEnabled && (
                <div className="p-3 border-b border-surface-200 dark:border-surface-700">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
                    <input
                      ref={searchInputRef}
                      type="text"
                      placeholder="Search restaurants..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 bg-surface-100 dark:bg-surface-700 rounded-lg text-sm text-surface-900 dark:text-surface-100 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                </div>
              )}

              {/* Scrollable List */}
              <div
                className="overflow-y-auto max-h-80 p-3 space-y-1"
                ref={listRef}
                role="listbox"
                aria-label="Restaurants"
              >
                {/* All Option */}
                {showAllOption && (
                  <motion.button
                    onClick={() => {
                      onSwitch('all')
                      setSelectedId('all')
                      setIsOpen(false)
                    }}
                    className={`w-full flex items-center gap-3 p-2.5 rounded-lg ${
                      selectedId === 'all'
                        ? 'bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800'
                        : 'hover:bg-surface-50 dark:hover:bg-surface-700'
                    }`}
                    whileTap={{ scale: 0.98 }}
                    role="option"
                    aria-selected={selectedId === 'all'}
                  >
                    <div className="w-8 h-8 rounded-lg bg-surface-100 dark:bg-surface-700 flex items-center justify-center">
                      <Grid className="w-4 h-4 text-surface-600 dark:text-surface-400" />
                    </div>
                    <span className="font-medium text-surface-900 dark:text-surface-100">
                      {allOptionLabel}
                    </span>
                    {selectedId === 'all' && (
                      <Check className="w-4 h-4 text-primary-500 ml-auto" />
                    )}
                  </motion.button>
                )}

                {/* Grouped or Flat List */}
                {groupByRegion ? (
                  Object.entries(groupedRestaurants).map(([region, group]) => (
                    <div key={region} className="mb-3 last:mb-0">
                      <h3 className="text-xs font-semibold text-surface-500 dark:text-surface-400 uppercase tracking-wide mb-2 px-1">
                        {region}
                      </h3>
                      <div className="space-y-1">
                        {group.map((restaurant) => (
                          <motion.button
                            key={restaurant.id}
                            onClick={() => {
                              onSwitch(restaurant.id)
                              setSelectedId(restaurant.id)
                              setIsOpen(false)
                            }}
                            className={`w-full flex items-center gap-3 p-2.5 rounded-lg ${
                              selectedId === restaurant.id
                                ? 'bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800'
                                : 'hover:bg-surface-50 dark:hover:bg-surface-700'
                            }`}
                            whileTap={{ scale: 0.98 }}
                            role="option"
                            aria-selected={selectedId === restaurant.id}
                          >
                            <RestaurantLogo
                              logo_url={restaurant.logo_url}
                              name={restaurant.name}
                              size="sm"
                            />
                            <div className="flex-1 min-w-0 text-left">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-surface-900 dark:text-surface-100 truncate">
                                  {restaurant.name}
                                </span>
                                <StatusDot isActive={restaurant.is_active ?? true} />
                              </div>
                              {restaurant.metrics && (
                                <div className="flex items-center gap-2 text-xs text-surface-500 dark:text-surface-400">
                                  {restaurant.metrics.activeOrders !== undefined && (
                                    <span className="flex items-center gap-1">
                                      <ShoppingBag className="w-3 h-3" />
                                      {restaurant.metrics.activeOrders}
                                    </span>
                                  )}
                                  {restaurant.metrics.todayRevenue !== undefined && (
                                    <span className="flex items-center gap-1">
                                      <DollarSign className="w-3 h-3" />
                                      ${restaurant.metrics.todayRevenue.toLocaleString()}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                            {selectedId === restaurant.id && (
                              <Check className="w-4 h-4 text-primary-500 flex-shrink-0" />
                            )}
                          </motion.button>
                        ))}
                      </div>
                    </div>
                  ))
                ) : (
                  filteredRestaurants.map((restaurant) => (
                    <motion.button
                      key={restaurant.id}
                      onClick={() => {
                        onSwitch(restaurant.id)
                        setSelectedId(restaurant.id)
                        setIsOpen(false)
                      }}
                      className={`w-full flex items-center gap-3 p-2.5 rounded-lg ${
                        selectedId === restaurant.id
                          ? 'bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800'
                          : 'hover:bg-surface-50 dark:hover:bg-surface-700'
                      }`}
                      whileTap={{ scale: 0.98 }}
                      role="option"
                      aria-selected={selectedId === restaurant.id}
                    >
                      <RestaurantLogo
                        logo_url={restaurant.logo_url}
                        name={restaurant.name}
                        size="sm"
                      />
                      <div className="flex-1 min-w-0 text-left">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-surface-900 dark:text-surface-100 truncate">
                            {restaurant.name}
                          </span>
                          <StatusDot isActive={restaurant.is_active ?? true} />
                        </div>
                        {restaurant.metrics && (
                          <div className="flex items-center gap-2 text-xs text-surface-500 dark:text-surface-400">
                            {restaurant.metrics.activeOrders !== undefined && (
                              <span className="flex items-center gap-1">
                                <ShoppingBag className="w-3 h-3" />
                                {restaurant.metrics.activeOrders}
                              </span>
                            )}
                            {restaurant.metrics.todayRevenue !== undefined && (
                              <span className="flex items-center gap-1">
                                <DollarSign className="w-3 h-3" />
                                ${restaurant.metrics.todayRevenue.toLocaleString()}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                      {selectedId === restaurant.id && (
                        <Check className="w-4 h-4 text-primary-500 flex-shrink-0" />
                      )}
                    </motion.button>
                  ))
                )}

                {filteredRestaurants.length === 0 && (
                  <div className="text-center py-6 text-surface-500 dark:text-surface-400">
                    <Search className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No restaurants found</p>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="p-3 border-t border-surface-200 dark:border-surface-700">
                <a
                  href="/dashboard/restaurant-profile"
                  className="flex items-center justify-center gap-2 w-full px-3 py-2 rounded-lg text-sm font-medium text-surface-600 dark:text-surface-400 hover:bg-surface-50 dark:hover:bg-surface-700 transition-colors"
                  onClick={() => setIsOpen(false)}
                >
                  <Settings className="w-4 h-4" />
                  Manage Restaurants
                </a>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </div>
  )
}

export default RestaurantSwitcher
