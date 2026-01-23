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

  const normalizeNotifications = (items: any[]): Notification[] => (
    items.map(item => ({
      ...item,
      timestamp: normalizeTimestamp(item?.timestamp)
    }))
  )

  const markAsRead = useCallback((id: string) => {
    setNotifications(prev => {
      const updated = prev.map(n =>
        n.id === id ? { ...n, read: true } : n
      )
      localStorage.setItem('servio_notifications', JSON.stringify(updated))
      return updated
    })

    setUnreadCount(prev => Math.max(0, prev - 1))
  }, [])

  const addNotification = useCallback((notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => {
    const newNotification: Notification = {
      ...notification,
      id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      read: false
    }

    setNotifications(prev => {
      const updated = [newNotification, ...prev].slice(0, 100) // Keep last 100 notifications
      localStorage.setItem('servio_notifications', JSON.stringify(updated))
      return updated
    })

    setUnreadCount(prev => prev + 1)

    // Auto-dismiss low priority notifications
    if (notification.priority === 'low') {
      setTimeout(() => {
        markAsRead(newNotification.id)
      }, 5000)
    }
  }, [markAsRead])

  useEffect(() => {
    // Load saved notifications from localStorage
    const savedNotifications = localStorage.getItem('servio_notifications')
    if (savedNotifications) {
      try {
        const parsed = JSON.parse(savedNotifications)
        const normalized = Array.isArray(parsed) ? normalizeNotifications(parsed) : []
        setNotifications(normalized)
        setUnreadCount(normalized.filter((n: Notification) => !n.read).length)
      } catch (error) {
        console.error('Failed to parse saved notifications:', error)
      }
    }

    // Prefetch alert sound
    const audio = new Audio('/sounds/order-alert.mp3')
    audio.preload = 'auto'
    setAlertAudio(audio)

    // Listen for socket events
    const handleOrderEvent = (data: any) => {
      addNotification({
        type: 'order',
        priority: 'medium',
        title: 'New Order',
        message: `Order #${data.id || data.orderId || 'Unknown'} received`,
        data
      })
      if (audio) {
        audio.currentTime = 0
        audio.play().catch(() => {})
      }
    }

    const handleNotificationEvent = (payload: any) => {
      const notif = payload?.notification || payload
      addNotification({
        type: 'system',
        priority: notif?.severity === 'high' ? 'high' : 'medium',
        title: notif?.title || 'Notification',
        message: notif?.message || 'New activity',
        data: notif
      })
      if (audio) {
        audio.currentTime = 0
        audio.play().catch(() => {})
      }
    }

    const handleInventoryLowStock = (data: any) => {
      addNotification({
        type: 'inventory',
        priority: 'high',
        title: 'Low Stock Alert',
        message: `${data.itemName || 'Item'} is running low (${data.currentLevel}/${data.threshold})`,
        data,
        actions: [
          {
            label: 'Reorder',
            action: () => console.log('Reorder item:', data.itemId),
            variant: 'primary'
          }
        ]
      })
    }

    const handleStaffClockIn = (data: any) => {
      addNotification({
        type: 'staff',
        priority: 'low',
        title: 'Staff Clock In',
        message: `${data.userName || 'Staff member'} clocked in`,
        data
      })
    }

    const handleTaskAssigned = (data: any) => {
      addNotification({
        type: 'task',
        priority: 'medium',
        title: 'Task Assigned',
        message: `New task: ${data.taskName || 'Task'}`,
        data,
        actions: [
          {
            label: 'View',
            action: () => console.log('View task:', data.taskId),
            variant: 'primary'
          }
        ]
      })
    }

    const handleVoiceCommand = (data: any) => {
      addNotification({
        type: 'voice',
        priority: 'low',
        title: 'Voice Command',
        message: `Processed: "${data.transcript}"`,
        data
      })
    }

    const handleSystemAlert = (data: any) => {
      addNotification({
        type: 'system',
        priority: data.priority || 'medium',
        title: 'System Alert',
        message: data.message,
        data
      })
    }

    // Register event listeners
    socket.on('order:new', handleOrderEvent)
    socket.on('new-order', handleOrderEvent)
    socket.on('notifications.new', handleNotificationEvent)
    socket.on('inventory:low_stock', handleInventoryLowStock)
    socket.on('staff:clock_in', handleStaffClockIn)
    socket.on('task:assigned', handleTaskAssigned)
    socket.on('voice:command_received', handleVoiceCommand)
    socket.on('system:alert', handleSystemAlert)

    return () => {
      // Cleanup event listeners
      socket.off('order:new', handleOrderEvent)
      socket.off('new-order', handleOrderEvent)
      socket.off('notifications.new', handleNotificationEvent)
      socket.off('inventory:low_stock', handleInventoryLowStock)
      socket.off('staff:clock_in', handleStaffClockIn)
      socket.off('task:assigned', handleTaskAssigned)
      socket.off('voice:command_received', handleVoiceCommand)
      socket.off('system:alert', handleSystemAlert)
    }
  }, [socket, addNotification])

  const markAllAsRead = () => {
    setNotifications(prev => {
      const updated = prev.map(n => ({ ...n, read: true }))
      localStorage.setItem('servio_notifications', JSON.stringify(updated))
      return updated
    })
    setUnreadCount(0)
  }

  const removeNotification = (id: string) => {
    setNotifications(prev => {
      const notification = prev.find(n => n.id === id)
      const updated = prev.filter(n => n.id !== id)
      localStorage.setItem('servio_notifications', JSON.stringify(updated))

      if (notification && !notification.read) {
        setUnreadCount(count => Math.max(0, count - 1))
      }

      return updated
    })
  }

  const clearAll = () => {
    setNotifications([])
    setUnreadCount(0)
    localStorage.removeItem('servio_notifications')
  }

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
                  {notifications.length === 0 ? (
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