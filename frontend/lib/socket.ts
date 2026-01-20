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

  // Staff events
  'staff:clock_in': (data: { userId: string; timestamp: Date }) => void
  'staff:clock_out': (data: { userId: string; timestamp: Date }) => void
  'staff:break_start': (data: { userId: string; timestamp: Date }) => void
  'staff:break_end': (data: { userId: string; timestamp: Date }) => void

  // Task events
  'task:assigned': (data: { taskId: string; assignedTo: string }) => void
  'task:completed': (data: { taskId: string; completedBy: string; timestamp: Date }) => void
  'task:overdue': (data: { taskId: string; dueDate: Date }) => void

  // Voice/Assistant events
  'voice:command_received': (data: { transcript: string; confidence: number }) => void
  'voice:action_completed': (data: { action: string; result: any }) => void

  // System events
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

  connect(): void {
    if (this.socket?.connected) {
      return
    }

    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3002'

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

      showToast.success('Connected to Servio')

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

      showToast.warning('Disconnected from Servio')
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
      showToast.success('Reconnected to Servio')
    })

    this.socket.on('reconnect_attempt', (attemptNumber) => {
      console.log('🔌 Reconnection attempt', attemptNumber)
      showToast.info(`Reconnecting... (${attemptNumber}/${this.maxReconnectAttempts})`)
    })

    this.socket.on('reconnect_failed', () => {
      console.error('🔌 Socket reconnection failed')
      showToast.error('Failed to reconnect to Servio. Please refresh the page.')
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