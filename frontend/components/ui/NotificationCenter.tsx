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
  Settings
} from 'lucide-react'
import { useSocket } from '../../lib/socket'
import { formatRelativeTime } from '../../lib/utils'
import axios from 'axios'

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
  const [unreadCount, setUnreadCount] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const socket = useSocket()
  const [alertAudio, setAlertAudio] = useState<HTMLAudioElement | null>(null)

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
      // Silently handle auth errors - user is not logged in
      if (error?.response?.status === 401) {
        // User is not authenticated, silently skip notifications
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
    // Fetch notifications on mount
    fetchNotifications()

    // Prefetch alert sound
    const audio = new Audio('/sounds/order-alert.mp3')
    audio.preload = 'auto'
    setAlertAudio(audio)

    // Listen for real-time notification events via socket
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

    // Register socket event listeners
    socket.on('notifications.new', handleNewNotification)
    socket.on('notifications.unread_count.updated', handleUnreadCountUpdate)

    // Also listen for order events
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
      low: 'text-surface-500 bg-surface-100 dark:bg-surface-800',
      medium: 'text-servio-orange-600 bg-servio-orange-100 dark:bg-servio-orange-900/30',
      high: 'text-servio-red-600 bg-servio-red-100 dark:bg-servio-red-900/30'
    }
    return colorMap[priority]
  }

  return (
    <div className={`relative ${className}`}>
      {/* Notification Bell */}
      <motion.button
        onClick={() => setIsOpen(!isOpen)}
        className="btn-icon relative"
        whileTap={{ scale: 0.95 }}
      >
        <Bell className="w-5 h-5" />

        {unreadCount > 0 && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute -top-1 -right-1 w-5 h-5 bg-servio-red-500 text-white text-2xs font-bold rounded-full flex items-center justify-center"
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </motion.span>
        )}
      </motion.button>

      {/* Notification Panel */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 lg:hidden"
              onClick={() => setIsOpen(false)}
            />

            {/* Panel */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -10 }}
              className="absolute right-0 top-12 w-96 max-w-[90vw] z-50"
            >
              <div className="card-glass border shadow-2xl max-h-[70vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-surface-200 dark:border-surface-700">
                  <h3 className="font-semibold text-surface-900 dark:text-surface-100">
                    Notifications
                  </h3>
                  <div className="flex items-center space-x-2">
                    {unreadCount > 0 && (
                      <button
                        onClick={markAllAsRead}
                        className="text-xs text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300"
                      >
                        Mark all read
                      </button>
                    )}
                    <button
                      onClick={() => setIsOpen(false)}
                      className="btn-icon w-6 h-6"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Notifications List */}
                <div className="flex-1 overflow-y-auto">
                  {isLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                  ) : notifications.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 text-center">
                      <Bell className="w-12 h-12 text-surface-300 dark:text-surface-600 mb-2" />
                      <p className="text-surface-500 dark:text-surface-400">No notifications</p>
                    </div>
                  ) : (
                    <div className="space-y-1 p-2">
                      {notifications.map((notification) => {
                        const Icon = getNotificationIcon(notification.type)

                        return (
                          <motion.div
                            key={notification.id}
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            className={`p-3 rounded-lg border transition-all duration-200 hover:bg-surface-50 dark:hover:bg-surface-800/50 ${
                              notification.read
                                ? 'bg-surface-50 dark:bg-surface-800/30 border-surface-200 dark:border-surface-700'
                                : 'bg-white dark:bg-surface-800 border-surface-300 dark:border-surface-600'
                            }`}
                            onClick={() => !notification.read && markAsRead(notification.id)}
                          >
                            <div className="flex items-start space-x-3">
                              <div className={`p-2 rounded-lg ${getPriorityColor(notification.priority)}`}>
                                <Icon className="w-4 h-4" />
                              </div>

                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between">
                                  <p className="font-medium text-surface-900 dark:text-surface-100 text-sm truncate">
                                    {notification.title}
                                  </p>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      removeNotification(notification.id)
                                    }}
                                    className="btn-icon w-5 h-5 opacity-0 group-hover:opacity-100"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </div>

                                <p className="text-surface-600 dark:text-surface-400 text-sm mt-1">
                                  {notification.message}
                                </p>

                                <div className="flex items-center justify-between mt-2">
                                  <span className="text-2xs text-surface-500 dark:text-surface-400">
                                    {formatRelativeTime(notification.timestamp)}
                                  </span>

                                  {!notification.read && (
                                    <div className="w-2 h-2 bg-primary-500 rounded-full" />
                                  )}
                                </div>

                                {/* Actions */}
                                {notification.actions && notification.actions.length > 0 && (
                                  <div className="flex items-center space-x-2 mt-3">
                                    {notification.actions.map((action, index) => (
                                      <button
                                        key={index}
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          action.action()
                                          markAsRead(notification.id)
                                        }}
                                        className={`text-xs px-3 py-1 rounded-lg font-medium ${
                                          action.variant === 'danger'
                                            ? 'bg-servio-red-100 text-servio-red-700 hover:bg-servio-red-200'
                                            : action.variant === 'primary'
                                            ? 'bg-primary-100 text-primary-700 hover:bg-primary-200'
                                            : 'bg-surface-100 text-surface-700 hover:bg-surface-200'
                                        }`}
                                      >
                                        {action.label}
                                      </button>
                                    ))}
                                  </div>
                                )}
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
                  <div className="p-3 border-t border-surface-200 dark:border-surface-700">
                    <button
                      onClick={clearAll}
                      className="w-full text-xs text-surface-500 dark:text-surface-400 hover:text-surface-700 dark:hover:text-surface-300"
                    >
                      Clear all notifications
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
