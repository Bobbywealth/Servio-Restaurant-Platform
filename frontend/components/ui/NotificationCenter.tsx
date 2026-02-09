'use client';

import React, { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Bell,
  X,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Info,
  ShoppingCart,
  Package,
  Users,
  Mic,
  Settings,
  Check,
  Trash2
} from 'lucide-react'
import { useSocket } from '../../lib/socket'
import { formatRelativeTime } from '../../lib/utils'
import axios from 'axios'
import dynamic from 'next/dynamic'

// Lazy load the settings modal
const NotificationSettings = dynamic(
  () => import('../settings/NotificationSettings'),
  { ssr: false }
)

export interface Notification {
  id: string
  type: 'order' | 'inventory' | 'staff' | 'voice' | 'system' | 'task'
  priority: 'low' | 'medium' | 'high'
  title: string
  message: string
  timestamp: Date
  read: boolean
  actions?: Array<{
    label: string
    action: () => void
    variant?: 'primary' | 'secondary' | 'danger'
  }>
  data?: any
}

interface NotificationCenterProps {
  className?: string
}

export default function NotificationCenter({ className = '' }: NotificationCenterProps) {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const socket = useSocket()
  const [alertAudio, setAlertAudio] = useState<HTMLAudioElement | null>(null)

  // Detect mobile viewport
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 640)
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  const normalizeTimestamp = (value: unknown): Date => {
    if (value instanceof Date) return value
    if (typeof value === 'string' || typeof value === 'number') {
      const parsed = new Date(value)
      if (!Number.isNaN(parsed.getTime())) return parsed
    }
    return new Date()
  }

  // Fetch notifications from database API
  const fetchNotifications = useCallback(async () => {
    try {
      setIsLoading(true)
      const response = await axios.get('/api/notifications?limit=100')
      if (response.data.success) {
        const normalized = response.data.data.items.map((item: any) => ({
          ...item,
          timestamp: normalizeTimestamp(item.created_at),
          read: item.is_read
        }))
        setNotifications(normalized)
        setUnreadCount(response.data.data.unreadCount)
      }
    } catch (error: any) {
      if (error?.response?.status === 401) {
        return
      }
      console.error('Failed to fetch notifications:', error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Mark notification as read
  const markAsRead = useCallback(async (id: string) => {
    try {
      await axios.post(`/api/notifications/${id}/read`)
      setNotifications(prev =>
        prev.map(n => (n.id === id ? { ...n, read: true } : n))
      )
      setUnreadCount(prev => Math.max(0, prev - 1))
    } catch (error) {
      console.error('Failed to mark notification as read:', error)
    }
  }, [])

  // Mark all as read
  const markAllAsRead = useCallback(async () => {
    try {
      await axios.post('/api/notifications/read-all')
      setNotifications(prev => prev.map(n => ({ ...n, read: true })))
      setUnreadCount(0)
    } catch (error) {
      console.error('Failed to mark all as read:', error)
    }
  }, [])

  // Clear all notifications
  const clearAll = useCallback(async () => {
    try {
      await axios.delete('/api/notifications/clear-all')
      setNotifications([])
      setUnreadCount(0)
    } catch (error) {
      console.error('Failed to clear notifications:', error)
    }
  }, [])

  // Remove single notification
  const removeNotification = useCallback(async (id: string) => {
    try {
      await axios.delete(`/api/notifications/${id}`)
      setNotifications(prev => {
        const notification = prev.find(n => n.id === id)
        if (notification && !notification.read) {
          setUnreadCount(count => Math.max(0, count - 1))
        }
        return prev.filter(n => n.id !== id)
      })
    } catch (error) {
      console.error('Failed to remove notification:', error)
    }
  }, [])

  useEffect(() => {
    const accessToken = localStorage.getItem('servio_access_token')
    if (!accessToken) {
      setIsLoading(false)
      return
    }

    fetchNotifications()

    const audio = new Audio('/sounds/order-alert.mp3')
    audio.preload = 'auto'
    setAlertAudio(audio)

    const handleNewNotification = (data: any) => {
      const newNotification: Notification = {
        id: data.id || `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: data.type || 'system',
        priority: data.priority || 'medium',
        title: data.title || 'New Notification',
        message: data.message || 'New activity',
        timestamp: new Date(),
        read: false,
        data
      }

      setNotifications(prev => [newNotification, ...prev].slice(0, 100))
      setUnreadCount(prev => prev + 1)

      if (audio) {
        audio.currentTime = 0
        audio.play().catch(() => {})
      }
    }

    const handleUnreadCountUpdate = (data: { unreadCount: number }) => {
      setUnreadCount(data.unreadCount)
    }

    const handleOrderEvent = (data: any) => {
      const notif: Notification = {
        id: `order_${Date.now()}`,
        type: 'order',
        priority: 'medium',
        title: 'New Order',
        message: `Order #${data.id || data.orderId || 'Unknown'} received`,
        timestamp: new Date(),
        read: false,
        data
      }
      setNotifications(prev => [notif, ...prev])
      setUnreadCount(prev => prev + 1)
      if (audio) {
        audio.currentTime = 0
        audio.play().catch(() => {})
      }
    }

    socket.on('notifications.new', handleNewNotification)
    socket.on('notifications.unread_count.updated', handleUnreadCountUpdate)
    socket.on('order:new', handleOrderEvent)
    socket.on('new-order', handleOrderEvent)

    return () => {
      socket.off('notifications.new', handleNewNotification)
      socket.off('notifications.unread_count.updated', handleUnreadCountUpdate)
      socket.off('order:new', handleOrderEvent)
      socket.off('new-order', handleOrderEvent)
    }
  }, [socket, fetchNotifications])

  const getNotificationIcon = (type: Notification['type']) => {
    const iconMap = {
      order: ShoppingCart,
      inventory: Package,
      staff: Users,
      voice: Mic,
      system: Settings,
      task: CheckCircle2
    }
    return iconMap[type] || Info
  }

  const getPriorityColor = (priority: Notification['priority']) => {
    const colorMap = {
      low: 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400',
      medium: 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400',
      high: 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400'
    }
    return colorMap[priority]
  }

  // Mobile bottom sheet variants
  const mobileVariants = {
    hidden: { y: '100%' },
    visible: { y: 0, transition: { type: 'spring' as const, stiffness: 300, damping: 30 } },
    exit: { y: '100%', transition: { duration: 0.2 } }
  }

  // Desktop panel variants
  const desktopVariants = {
    hidden: { opacity: 0, scale: 0.95, y: -10 },
    visible: { opacity: 1, scale: 1, y: 0, transition: { type: 'spring' as const, stiffness: 300, damping: 25 } },
    exit: { opacity: 0, scale: 0.95, y: -10, transition: { duration: 0.15 } }
  }

  return (
    <div className={`relative ${className}`}>
      {/* Notification Bell */}
      <motion.button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-xl bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
        whileTap={{ scale: 0.95 }}
        whileHover={{ scale: 1.02 }}
      >
        <Bell className="w-5 h-5 text-gray-700 dark:text-gray-300" />
        
        {unreadCount > 0 && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 bg-gradient-to-br from-red-500 to-red-600 text-white text-xs font-bold rounded-full flex items-center justify-center shadow-lg"
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </motion.span>
        )}
      </motion.button>

      {/* Notification Panel */}
      <AnimatePresence mode="wait">
        {isOpen && (
          <>
            {/* Mobile backdrop with blur */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 bg-black/20 dark:bg-black/40 backdrop-blur-sm z-40 lg:hidden"
              onClick={() => setIsOpen(false)}
            />

            {/* Panel - Mobile: Bottom sheet, Desktop: Dropdown */}
            <motion.div
              initial="hidden"
              animate="visible"
              exit="exit"
              variants={isMobile ? mobileVariants : desktopVariants}
              className={`
                ${isMobile 
                  ? 'fixed bottom-0 left-0 right-0 z-50 rounded-t-2xl' 
                  : 'absolute right-0 top-14 z-50 w-full sm:w-96 max-w-[calc(100vw-2rem)]'
                }
              `}
            >
              <div className="
                bg-white dark:bg-gray-900 
                border border-gray-200 dark:border-gray-700
                shadow-2xl overflow-hidden
                flex flex-col
                ${isMobile ? 'rounded-t-2xl max-h-[70vh]' : 'rounded-xl max-h-[600px]'}
              ">
                {/* Header */}
                <div className="
                  flex items-center justify-between px-4 py-3
                  bg-gray-50 dark:bg-gray-800/50
                  border-b border-gray-200 dark:border-gray-700
                  sticky top-0 z-10
                ">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-gray-900 dark:text-white text-base">
                      Notifications
                    </h3>
                    {unreadCount > 0 && (
                      <span className="px-2 py-0.5 bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 text-xs font-medium rounded-full">
                        {unreadCount}
                      </span>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-1">
                    {unreadCount > 0 && (
                      <button
                        onClick={markAllAsRead}
                        className="p-1.5 text-xs text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-colors"
                        title="Mark all as read"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setIsOpen(false)
                        setIsSettingsOpen(true)
                      }}
                      className="p-1.5 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                      title="Notification Settings"
                    >
                      <Settings className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setIsOpen(false)}
                      className="p-1.5 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors lg:hidden"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Notifications List */}
                <div className="flex-1 overflow-y-auto">
                  {isLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                  ) : notifications.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                      <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4">
                        <Bell className="w-8 h-8 text-gray-400 dark:text-gray-500" />
                      </div>
                      <p className="text-gray-600 dark:text-gray-400 font-medium mb-1">
                        All caught up!
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-500">
                        No new notifications
                      </p>
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-100 dark:divide-gray-800">
                      {notifications.map((notification, index) => {
                        const Icon = getNotificationIcon(notification.type)

                        return (
                          <motion.div
                            key={notification.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.03 }}
                            className={`
                              relative p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors cursor-pointer
                              ${!notification.read ? 'bg-primary-50/50 dark:bg-primary-900/10' : ''}
                            `}
                            onClick={() => !notification.read && markAsRead(notification.id)}
                          >
                            {/* Unread indicator dot */}
                            {!notification.read && (
                              <span className="absolute left-1.5 top-1/2 -translate-y-1/2 w-1.5 h-1.5 bg-primary-500 rounded-full" />
                            )}
                            
                            <div className="flex gap-3 pl-2">
                              {/* Icon */}
                              <div className={`
                                w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0
                                ${getPriorityColor(notification.priority)}
                              `}>
                                <Icon className="w-5 h-5" />
                              </div>

                              {/* Content */}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-2">
                                  <p className={`
                                    font-medium text-sm truncate
                                    ${notification.read 
                                      ? 'text-gray-700 dark:text-gray-300' 
                                      : 'text-gray-900 dark:text-white'
                                    }
                                  `}>
                                    {notification.title}
                                  </p>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      removeNotification(notification.id)
                                    }}
                                    className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors opacity-0 group-hover:opacity-100"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </div>

                                <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">
                                  {notification.message}
                                </p>

                                <div className="flex items-center justify-between mt-2">
                                  <span className="text-xs text-gray-400 dark:text-gray-500">
                                    {formatRelativeTime(notification.timestamp)}
                                  </span>

                                  {/* Quick actions */}
                                  {notification.actions && notification.actions.length > 0 && (
                                    <div className="flex gap-1">
                                      {notification.actions.slice(0, 2).map((action, idx) => (
                                        <button
                                          key={idx}
                                          onClick={(e) => {
                                            e.stopPropagation()
                                            action.action()
                                            markAsRead(notification.id)
                                          }}
                                          className={`
                                            px-2 py-1 text-xs font-medium rounded-lg
                                            ${action.variant === 'danger'
                                              ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50'
                                              : action.variant === 'primary'
                                              ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 hover:bg-primary-200 dark:hover:bg-primary-900/50'
                                              : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                                            }
                                          `}
                                        >
                                          {action.label}
                                        </button>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        )
                      })}
                    </div>
                  )}
                </div>

                {/* Footer */}
                {notifications.length > 0 && (
                  <div className="
                    px-4 py-3
                    bg-gray-50 dark:bg-gray-800/50
                    border-t border-gray-200 dark:border-gray-700
                    flex items-center justify-between
                  ">
                    <button
                      onClick={clearAll}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Clear all
                    </button>
                    <span className="text-xs text-gray-400 dark:text-gray-500">
                      {notifications.length} notification{notifications.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Settings Modal */}
      <NotificationSettings
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </div>
  )
}
