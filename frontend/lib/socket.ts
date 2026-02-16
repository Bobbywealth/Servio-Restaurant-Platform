import { io, Socket, ManagerOptions } from 'socket.io-client'
import { showToast } from '../components/ui/Toast'

// Extend ManagerOptions to include ping properties
interface ManagerOptionsWithPing extends ManagerOptions {
  pingTimeout?: number
  pingInterval?: number
}

export interface SocketEvents {
  // Order events
  'order:new': (order: any) => void
  'order:updated': (order: any) => void
  'order:status_changed': (data: { orderId: string; status: string; timestamp: Date }) => void
  'order:assigned': (data: { orderId: string; assignedTo: string }) => void

  // Menu/Inventory events
  'menu:availability_changed': (data: { itemId: string; isAvailable: boolean; channels: string[] }) => void
  'inventory:low_stock': (data: { itemId: string; currentLevel: number; threshold: number }) => void
  'inventory:updated': (data: { itemId: string; newQuantity: number }) => void

  // Menu collaboration events
  'menu:user:joined': (data: { userId: string; userName: string; timestamp: Date }) => void
  'menu:user:left': (data: { userId: string; userName: string; timestamp: Date }) => void
  'menu:active:edits': (sessions: any[]) => void
  'menu:edit:started': (data: { itemType: 'category' | 'item' | 'modifier'; itemId: string; userId: string; userName: string; startedAt: Date }) => void
  'menu:edit:ended': (data: { itemType: 'category' | 'item' | 'modifier'; itemId: string; userId: string }) => void
  'menu:edit:conflict': (data: { itemType: 'category' | 'item' | 'modifier'; itemId: string; editingBy: { userId: string; userName: string }; startedAt: Date }) => void
  'menu:updated': (data: { type: 'create' | 'update' | 'delete' | 'reorder'; entityType: 'category' | 'item' | 'modifier'; entityId: string; restaurantId: string; userId: string; userName: string; data?: any; timestamp: Date }) => void
  'menu:cursor:update': (data: { userId: string; userName: string; field: string; position: number; timestamp: Date }) => void

  // Staff events
  'staff:clock_in': (data: { userId: string; timestamp: Date }) => void
  'staff:clock_out': (data: { userId: string; timestamp: Date }) => void
  'staff:break_start': (data: { userId: string; timestamp: Date }) => void
  'staff:break_end': (data: { userId: string; timestamp: Date }) => void
  'staff.schedule_created': (data: any) => void
  'staff.schedule_updated': (data: any) => void
  'staff.schedule_deleted': (data: any) => void
  'staff.schedule_published': (data: any) => void
  'staff.time_entry_created': (data: any) => void
  'staff.time_entry_updated': (data: any) => void

  // Task events
  'task:assigned': (data: { taskId: string; assignedTo: string }) => void
  'task:completed': (data: { taskId: string; completedBy: string; timestamp: Date }) => void
  'task:overdue': (data: { taskId: string; dueDate: Date }) => void
  'task:updated': (data: { taskId: string; task?: any; action: string }) => void

  // Voice/Assistant events
  'voice:command_received': (data: { transcript: string; confidence: number }) => void
  'voice:action_completed': (data: { action: string; result: any }) => void
  'call:ended': (data: { sessionId: string }) => void

  // System events
  'notifications.new': (data: { notification: any }) => void
  'notifications.unread_count.updated': (data: { unreadCount: number }) => void
  'campaign:event': (data: {
    eventType: 'created' | 'approved' | 'disapproved' | 'sent'
    campaignId: string
    campaignName?: string
    restaurantId: string
    restaurantName?: string
    timestamp: string
    metadata?: Record<string, unknown>
  }) => void
  'new-order': (data: any) => void
  'printer.test': () => void
  'system:notification': (data: { type: string; message: string; priority: 'low' | 'medium' | 'high' }) => void
  'system:alert': (data: { type: string; message: string; data?: any }) => void

  // Connection events
  'connect': () => void
  'disconnect': (reason: string) => void
  'connect_error': (error: Error) => void
  'reconnect': (attemptNumber: number) => void
  'reconnect_attempt': (attemptNumber: number) => void
  'reconnect_failed': () => void
}

class SocketManager {
  private socket: Socket | null = null
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private reconnectDelay = 1000
  private isConnected = false
  private connectionListeners: Array<(status: boolean) => void> = []
  private eventHandlers = new Map<string, Function[]>()

  constructor() {
    this.connect()
  }

  private resolveBackendUrl(): string {
    const rawBackendUrl =
      process.env.NEXT_PUBLIC_API_URL ||
      process.env.NEXT_PUBLIC_BACKEND_URL

    if (!rawBackendUrl) {
      throw new Error('NEXT_PUBLIC_API_URL or NEXT_PUBLIC_BACKEND_URL environment variable is required')
    }

    if (rawBackendUrl.startsWith('http')) {
      return rawBackendUrl
    }

    if (typeof window !== 'undefined') {
      return `${window.location.protocol}//${rawBackendUrl}`
    }

    return `http://${rawBackendUrl}`
  }

  connect(): void {
    if (typeof window === 'undefined') {
      return
    }

    if (this.socket?.connected) {
      return
    }

    const backendUrl = this.resolveBackendUrl()

    const socketOptions = {
      transports: ['websocket', 'polling'],
      timeout: 20000,
      reconnection: true,
      reconnectionAttempts: this.maxReconnectAttempts,
      reconnectionDelay: this.reconnectDelay,
      reconnectionDelayMax: 5000,
      pingTimeout: 60000,
      pingInterval: 25000,
    } as Partial<ManagerOptionsWithPing>

    this.socket = io(backendUrl, socketOptions)

    this.setupEventListeners()
  }

  private setupEventListeners(): void {
    if (!this.socket) return

    // Connection events
    this.socket.on('connect', () => {
      console.log('🔌 Socket connected:', this.socket?.id)
      this.isConnected = true
      this.reconnectAttempts = 0
      this.notifyConnectionListeners(true)

      // Join user room if authenticated
      const user = this.getUserFromStorage()
      if (user) {
        this.socket?.emit('join:user', { userId: user.id, restaurantId: user.restaurantId })
      }
    })

    this.socket.on('disconnect', (reason) => {
      console.log('🔌 Socket disconnected:', reason)
      this.isConnected = false
      this.notifyConnectionListeners(false)

      if (reason === 'io server disconnect') {
        // Server initiated disconnect - reconnect manually
        this.socket?.connect()
      }
    })

    this.socket.on('connect_error', (error) => {
      console.error('🔌 Socket connection error:', error)
      this.reconnectAttempts++

      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        showToast.error('Unable to connect to Servio. Please refresh the page.')
      }
    })

    this.socket.on('reconnect', (attemptNumber) => {
      console.log('🔌 Socket reconnected after', attemptNumber, 'attempts')
    })

    this.socket.on('reconnect_attempt', (attemptNumber) => {
      console.log('🔌 Reconnection attempt', attemptNumber)
    })

    this.socket.on('reconnect_failed', () => {
      console.error('🔌 Socket reconnection failed')
    })

    // System events
    this.socket.on('system:notification', (data) => {
      const { type, message, priority } = data

      switch (priority) {
        case 'high':
          showToast.error(message)
          break
        case 'medium':
          showToast.warning(message)
          break
        default:
          showToast.info(message)
      }
    })

    this.socket.on('system:alert', (data) => {
      showToast.warning(data.message)
    })
  }

  // Event handling
  on<K extends keyof SocketEvents>(event: K, handler: SocketEvents[K]): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, [])
    }

    this.eventHandlers.get(event)?.push(handler as Function)
    this.socket?.on(event, handler as any)
  }

  off<K extends keyof SocketEvents>(event: K, handler?: SocketEvents[K]): void {
    if (handler) {
      const handlers = this.eventHandlers.get(event) || []
      const index = handlers.indexOf(handler as Function)
      if (index > -1) {
        handlers.splice(index, 1)
      }
      this.socket?.off(event, handler as any)
    } else {
      this.eventHandlers.delete(event)
      this.socket?.off(event)
    }
  }

  emit(event: string, data?: any): void {
    if (this.isConnected) {
      this.socket?.emit(event, data)
    } else {
      console.warn('🔌 Cannot emit - socket not connected')
      showToast.warning('Not connected to server')
    }
  }

  // Connection status
  onConnectionChange(callback: (status: boolean) => void): () => void {
    this.connectionListeners.push(callback)

    // Return cleanup function
    return () => {
      const index = this.connectionListeners.indexOf(callback)
      if (index > -1) {
        this.connectionListeners.splice(index, 1)
      }
    }
  }

  private notifyConnectionListeners(status: boolean): void {
    this.connectionListeners.forEach(callback => callback(status))
  }

  get connected(): boolean {
    return this.isConnected && !!this.socket?.connected
  }

  get id(): string | undefined {
    return this.socket?.id
  }

  // User management
  private getUserFromStorage() {
    try {
      const user = localStorage.getItem('servio_user')
      return user ? JSON.parse(user) : null
    } catch {
      return null
    }
  }

  joinUserRoom(userId: string, restaurantId?: string): void {
    this.emit('join:user', { userId, restaurantId })
  }

  leaveUserRoom(userId: string): void {
    this.emit('leave:user', { userId })
  }

  joinRestaurantRoom(restaurantId: string): void {
    this.emit('join:restaurant', { restaurantId })
  }

  leaveRestaurantRoom(restaurantId: string): void {
    this.emit('leave:restaurant', { restaurantId })
  }

  // Disconnect
  disconnect(): void {
    this.socket?.disconnect()
    this.socket = null
    this.isConnected = false
    this.eventHandlers.clear()
    this.connectionListeners.length = 0
  }

  // Reconnect manually
  reconnect(): void {
    this.disconnect()
    this.connect()
  }
}

// Singleton instance
export const socketManager = new SocketManager()

// React hook for socket management
export function useSocket() {
  return socketManager
}
