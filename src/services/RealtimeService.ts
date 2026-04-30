import { Server as SocketIOServer, Socket } from 'socket.io';
import { logger } from '../utils/logger';
import { buildRestaurantRoom, buildUserRoom, ROOM_NAMING_CONVENTION } from '../constants/realtimeRooms';

export type EventType = 
  | 'order:created'
  | 'order:updated'
  | 'order:status_changed'
  | 'menu:updated'
  | 'menu:item_updated'
  | 'staff:clock_in'
  | 'staff:clock_out'
  | 'staff:break_start'
  | 'staff:break_end'
  | 'inventory:low_stock'
  | 'notification:new';

export interface RealtimeEvent {
  type: EventType;
  payload: any;
  restaurantId?: string;
  userId?: string;
  timestamp: string;
  requestId?: string;
}

export interface RoomSubscription {
  userId: string;
  rooms: string[];
  socketId: string;
}

interface AuthenticatePayload {
  userId: string;
  restaurantId?: string;
  restaurantIds?: string[];
}

/**
 * Enhanced Realtime Service for WebSocket subscriptions
 * Supports:
 * - Room-based subscriptions (per restaurant, per user)
 * - Event filtering
 * - Real-time order updates
 * - Staff presence tracking
 * - Push notification delivery
 */
export class RealtimeService {
  private static instance: RealtimeService;
  private io: SocketIOServer | null = null;
  private subscriptions: Map<string, RoomSubscription[]> = new Map();
  
  private constructor() {}
  
  static getInstance(): RealtimeService {
    if (!RealtimeService.instance) {
      RealtimeService.instance = new RealtimeService();
    }
    return RealtimeService.instance;
  }
  
  /**
   * Initialize with Socket.IO server
   */
  initialize(io: SocketIOServer): void {
    this.io = io;
    this.setupSocketHandlers();
    logger.info('[Realtime] Service initialized');
  }
  
  /**
   * Set up socket connection handlers
   */
  private setupSocketHandlers(): void {
    if (!this.io) return;
    
    this.io.on('connection', (socket: Socket) => {
      logger.info(`[Socket] Client connected: ${socket.id}`);
      
      // Handle authentication
      socket.on('authenticate', (data: AuthenticatePayload) => {
        this.handleAuthentication(socket, data);
      });
      
      // Handle room subscriptions
      socket.on('subscribe', (data: { rooms: string[] }) => {
        this.handleSubscription(socket, data.rooms);
      });
      
      // Handle room unsubscription
      socket.on('unsubscribe', (data: { rooms: string[] }) => {
        this.handleUnsubscription(socket, data.rooms);
      });
      
      // Handle restaurant-specific events
      socket.on('join:restaurant', (data: { restaurantId: string }) => {
        this.handleRestaurantJoin(socket, data.restaurantId);
      });

      // Backwards compatibility with legacy event name.
      socket.on('join_restaurant', (data: { restaurantId: string }) => {
        this.handleRestaurantJoin(socket, data.restaurantId);
      });
      
      socket.on('leave:restaurant', (data: { restaurantId: string }) => {
        socket.leave(buildRestaurantRoom(data.restaurantId));
      });

      socket.on('join:user', (data: { userId: string; restaurantId?: string }) => {
        this.handleAuthentication(socket, {
          userId: data.userId,
          restaurantId: data.restaurantId
        });
      });

      socket.on('leave_restaurant', (data: { restaurantId: string }) => {
        socket.leave(buildRestaurantRoom(data.restaurantId));
      });
      
      // Handle disconnection
      socket.on('disconnect', (reason) => {
        this.handleDisconnection(socket, reason);
      });
      
      // Ping/pong for connection health
      socket.on('ping', () => {
        socket.emit('pong', { timestamp: Date.now() });
      });
    });
  }
  
  /**
   * Handle client authentication
   */
  private handleAuthentication(socket: Socket, data: AuthenticatePayload): void {
    const { userId, restaurantId } = data;
    const allowedRestaurantIds = new Set(data.restaurantIds || []);
    if (restaurantId) {
      allowedRestaurantIds.add(restaurantId);
    }
    
    // Store with user association socket
    socket.data.userId = userId;
    socket.data.restaurantId = restaurantId;
    
    // Join user's personal room
    socket.join(buildUserRoom(userId));
    
    // Join restaurant room if provided
    if (restaurantId) {
      socket.join(buildRestaurantRoom(restaurantId));
    }

    socket.data.allowedRestaurantIds = allowedRestaurantIds;
    
    // Store subscription
    const userSubs = (this.subscriptions.get(userId) || []).filter(sub => sub.socketId !== socket.id);
    userSubs.push({
      userId,
      rooms: [buildUserRoom(userId), ...(restaurantId ? [buildRestaurantRoom(restaurantId)] : [])],
      socketId: socket.id
    });
    this.subscriptions.set(userId, userSubs);
    
    // Confirm authentication
    socket.emit('authenticated', { userId, socketId: socket.id });
    
    logger.info(`[Socket] Client authenticated: ${socket.id}, user: ${userId}, roomConvention: ${ROOM_NAMING_CONVENTION}`);
  }

  private handleRestaurantJoin(socket: Socket, restaurantId: string): void {
    const allowedRestaurantIds = socket.data.allowedRestaurantIds as Set<string> | undefined;
    const isAllowed = !allowedRestaurantIds || allowedRestaurantIds.has(restaurantId);
    const roomName = buildRestaurantRoom(restaurantId);

    if (!isAllowed) {
      socket.emit('room:join_denied', {
        room: roomName,
        reason: 'forbidden'
      });
      logger.warn(`[Socket] ${socket.id} denied join for ${roomName}`);
      return;
    }

    socket.join(roomName);
    logger.info(`[Socket] ${socket.id} joined ${roomName}`);
  }
  
  /**
   * Handle room subscriptions
   */
  private handleSubscription(socket: Socket, rooms: string[]): void {
    rooms.forEach(room => {
      socket.join(room);
    });
    
    socket.emit('subscribed', { rooms });
    logger.info(`[Socket] ${socket.id} subscribed to: ${rooms.join(', ')}`);
  }
  
  /**
   * Handle room unsubscription
   */
  private handleUnsubscription(socket: Socket, rooms: string[]): void {
    rooms.forEach(room => {
      socket.leave(room);
    });
    
    socket.emit('unsubscribed', { rooms });
  }
  
  /**
   * Handle disconnection
   */
  private handleDisconnection(socket: Socket, reason: string): void {
    const userId = socket.data.userId;
    
    if (userId) {
      const userSubs = this.subscriptions.get(userId) || [];
      const filtered = userSubs.filter(s => s.socketId !== socket.id);
      this.subscriptions.set(userId, filtered);
    }
    
    logger.info(`[Socket] Client disconnected: ${socket.id}, reason: ${reason}`);
  }
  
  /**
   * Emit event to specific rooms
   */
  emit(event: RealtimeEvent): void {
    if (!this.io) return;
    
    const { type, payload, restaurantId, userId } = event;
    const timestamp = event.timestamp || new Date().toISOString();
    
    // Emit to restaurant room if specified
    if (restaurantId) {
      this.io.to(buildRestaurantRoom(restaurantId)).emit(type, {
        ...payload,
        _meta: { type, timestamp, restaurantId }
      });
    }
    
    // Emit to user room if specified
    if (userId) {
      this.io.to(buildUserRoom(userId)).emit(type, {
        ...payload,
        _meta: { type, timestamp, userId }
      });
    }
    
    logger.debug(`[Realtime] Emitted event: ${type}`, { restaurantId, userId });
  }
  
  /**
   * Emit to specific socket
   */
  emitToSocket(socketId: string, event: string, data: any): void {
    if (!this.io) return;
    this.io.to(socketId).emit(event, data);
  }
  
  /**
   * Emit to user across all their connections
   */
  emitToUser(userId: string, event: string, data: any): void {
    if (!this.io) return;
    this.io.to(buildUserRoom(userId)).emit(event, data);
  }
  
  /**
   * Emit to restaurant
   */
  emitToRestaurant(restaurantId: string, event: string, data: any): void {
    if (!this.io) return;
    this.io.to(buildRestaurantRoom(restaurantId)).emit(event, data);
  }
  
  /**
   * Convenience methods for common events
   */
  notifyOrderCreated(restaurantId: string, order: any): void {
    this.emit({
      type: 'order:created',
      payload: order,
      restaurantId,
      timestamp: new Date().toISOString()
    });
  }
  
  notifyOrderUpdated(restaurantId: string, order: any): void {
    this.emit({
      type: 'order:updated',
      payload: order,
      restaurantId,
      timestamp: new Date().toISOString()
    });
  }
  
  notifyOrderStatusChanged(restaurantId: string, order: any): void {
    this.emit({
      type: 'order:status_changed',
      payload: order,
      restaurantId,
      timestamp: new Date().toISOString()
    });
  }
  
  notifyMenuUpdated(restaurantId: string, menu: any): void {
    this.emit({
      type: 'menu:updated',
      payload: menu,
      restaurantId,
      timestamp: new Date().toISOString()
    });
  }
  
  notifyStaffClockIn(restaurantId: string, staff: any): void {
    this.emit({
      type: 'staff:clock_in',
      payload: staff,
      restaurantId,
      timestamp: new Date().toISOString()
    });
  }
  
  notifyStaffClockOut(restaurantId: string, staff: any): void {
    this.emit({
      type: 'staff:clock_out',
      payload: staff,
      restaurantId,
      timestamp: new Date().toISOString()
    });
  }
  
  notifyLowStock(restaurantId: string, inventory: any): void {
    this.emit({
      type: 'inventory:low_stock',
      payload: inventory,
      restaurantId,
      timestamp: new Date().toISOString()
    });
  }
  
  /**
   * Get active connections count
   */
  getConnectionCount(): number {
    return this.io?.sockets.sockets.size || 0;
  }
  
  /**
   * Get user connections
   */
  getUserConnections(userId: string): number {
    return this.subscriptions.get(userId)?.length || 0;
  }

  resetForTests(): void {
    this.subscriptions.clear();
    this.io = null;
  }
}

// Export singleton
export const realtimeService = RealtimeService.getInstance();
