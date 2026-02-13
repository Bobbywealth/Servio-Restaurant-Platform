/**
 * Menu Real-time Collaboration Service
 * Handles WebSocket events for real-time menu updates across clients
 */

import { Server as SocketServer, Socket } from 'socket.io';
import { logger } from '../utils/logger';

interface MenuEditSession {
  restaurantId: string;
  userId: string;
  userName: string;
  itemType: 'category' | 'item' | 'modifier';
  itemId: string;
  action: 'editing' | 'viewing';
  startedAt: Date;
}

interface MenuUpdateEvent {
  type: 'create' | 'update' | 'delete' | 'reorder';
  entityType: 'category' | 'item' | 'modifier';
  entityId: string;
  restaurantId: string;
  userId: string;
  userName: string;
  data?: any;
  timestamp: Date;
}

class MenuCollaborationService {
  private io: SocketServer | null = null;
  private editSessions: Map<string, MenuEditSession> = new Map();
  private userSockets: Map<string, Set<string>> = new Map(); // userId -> socketIds

  /**
   * Initialize the collaboration service with Socket.IO server
   */
  initialize(socketServer: SocketServer): void {
    this.io = socketServer;
    
    this.io.on('connection', (socket: Socket) => {
      logger.info('Menu collaboration client connected', { socketId: socket.id });
      
      // Handle user joining a restaurant's menu room
      socket.on('menu:join', (data: { restaurantId: string; userId: string; userName: string }) => {
        this.handleJoinRoom(socket, data);
      });
      
      // Handle user leaving a restaurant's menu room
      socket.on('menu:leave', (data: { restaurantId: string; userId: string }) => {
        this.handleLeaveRoom(socket, data);
      });
      
      // Handle edit session start
      socket.on('menu:edit:start', (data: {
        restaurantId: string;
        userId: string;
        userName: string;
        itemType: 'category' | 'item' | 'modifier';
        itemId: string;
      }) => {
        this.handleEditStart(socket, data);
      });
      
      // Handle edit session end
      socket.on('menu:edit:end', (data: {
        restaurantId: string;
        userId: string;
        itemType: 'category' | 'item' | 'modifier';
        itemId: string;
      }) => {
        this.handleEditEnd(socket, data);
      });
      
      // Handle menu update broadcast
      socket.on('menu:update', (data: {
        type: 'create' | 'update' | 'delete' | 'reorder';
        entityType: 'category' | 'item' | 'modifier';
        entityId: string;
        restaurantId: string;
        userId: string;
        userName: string;
        data?: any;
      }) => {
        this.handleMenuUpdate(socket, data);
      });
      
      // Handle cursor position (for collaborative editing)
      socket.on('menu:cursor', (data: {
        restaurantId: string;
        userId: string;
        userName: string;
        field: string;
        position: number;
      }) => {
        this.handleCursorPosition(socket, data);
      });
      
      // Handle disconnection
      socket.on('disconnect', () => {
        this.handleDisconnect(socket);
      });
    });
    
    logger.info('Menu collaboration service initialized');
  }

  /**
   * Handle user joining a restaurant menu room
   */
  private handleJoinRoom(
    socket: Socket,
    data: { restaurantId: string; userId: string; userName: string }
  ): void {
    const roomName = this.getRoomName(data.restaurantId);
    socket.join(roomName);
    
    // Track user's sockets
    if (!this.userSockets.has(data.userId)) {
      this.userSockets.set(data.userId, new Set());
    }
    this.userSockets.get(data.userId)!.add(socket.id);
    
    // Store user info in socket data
    socket.data = {
      ...socket.data,
      restaurantId: data.restaurantId,
      userId: data.userId,
      userName: data.userName
    };
    
    // Notify others in the room
    socket.to(roomName).emit('menu:user:joined', {
      userId: data.userId,
      userName: data.userName,
      timestamp: new Date()
    });
    
    // Send current edit sessions to the new user
    const activeEdits = this.getActiveEditSessions(data.restaurantId);
    socket.emit('menu:active:edits', activeEdits);
    
    logger.info('User joined menu room', {
      userId: data.userId,
      restaurantId: data.restaurantId,
      roomName
    });
  }

  /**
   * Handle user leaving a restaurant menu room
   */
  private handleLeaveRoom(
    socket: Socket,
    data: { restaurantId: string; userId: string }
  ): void {
    const roomName = this.getRoomName(data.restaurantId);
    socket.leave(roomName);
    
    // Remove from user sockets tracking
    const userSocketSet = this.userSockets.get(data.userId);
    if (userSocketSet) {
      userSocketSet.delete(socket.id);
      if (userSocketSet.size === 0) {
        this.userSockets.delete(data.userId);
      }
    }
    
    // End any active edit sessions for this user
    this.endAllUserEditSessions(data.userId, data.restaurantId);
    
    // Notify others in the room
    socket.to(roomName).emit('menu:user:left', {
      userId: data.userId,
      timestamp: new Date()
    });
    
    logger.info('User left menu room', {
      userId: data.userId,
      restaurantId: data.restaurantId
    });
  }

  /**
   * Handle edit session start
   */
  private handleEditStart(
    socket: Socket,
    data: {
      restaurantId: string;
      userId: string;
      userName: string;
      itemType: 'category' | 'item' | 'modifier';
      itemId: string;
    }
  ): void {
    const sessionKey = `${data.restaurantId}:${data.itemType}:${data.itemId}`;
    const existingSession = this.editSessions.get(sessionKey);
    
    if (existingSession && existingSession.userId !== data.userId) {
      // Someone else is already editing - notify the user
      socket.emit('menu:edit:conflict', {
        itemType: data.itemType,
        itemId: data.itemId,
        editingBy: {
          userId: existingSession.userId,
          userName: existingSession.userName
        },
        startedAt: existingSession.startedAt
      });
      return;
    }
    
    // Start new edit session
    const session: MenuEditSession = {
      restaurantId: data.restaurantId,
      userId: data.userId,
      userName: data.userName,
      itemType: data.itemType,
      itemId: data.itemId,
      action: 'editing',
      startedAt: new Date()
    };
    
    this.editSessions.set(sessionKey, session);
    
    // Broadcast to room
    const roomName = this.getRoomName(data.restaurantId);
    this.io?.to(roomName).emit('menu:edit:started', {
      itemType: data.itemType,
      itemId: data.itemId,
      userId: data.userId,
      userName: data.userName,
      startedAt: session.startedAt
    });
    
    logger.info('Edit session started', {
      userId: data.userId,
      itemType: data.itemType,
      itemId: data.itemId
    });
  }

  /**
   * Handle edit session end
   */
  private handleEditEnd(
    socket: Socket,
    data: {
      restaurantId: string;
      userId: string;
      itemType: 'category' | 'item' | 'modifier';
      itemId: string;
    }
  ): void {
    const sessionKey = `${data.restaurantId}:${data.itemType}:${data.itemId}`;
    const session = this.editSessions.get(sessionKey);
    
    if (session && session.userId === data.userId) {
      this.editSessions.delete(sessionKey);
      
      // Broadcast to room
      const roomName = this.getRoomName(data.restaurantId);
      this.io?.to(roomName).emit('menu:edit:ended', {
        itemType: data.itemType,
        itemId: data.itemId,
        userId: data.userId
      });
      
      logger.info('Edit session ended', {
        userId: data.userId,
        itemType: data.itemType,
        itemId: data.itemId
      });
    }
  }

  /**
   * Handle menu update broadcast
   */
  private handleMenuUpdate(
    socket: Socket,
    data: {
      type: 'create' | 'update' | 'delete' | 'reorder';
      entityType: 'category' | 'item' | 'modifier';
      entityId: string;
      restaurantId: string;
      userId: string;
      userName: string;
      data?: any;
    }
  ): void {
    const event: MenuUpdateEvent = {
      ...data,
      timestamp: new Date()
    };
    
    // End any edit session for this entity
    const sessionKey = `${data.restaurantId}:${data.entityType}:${data.entityId}`;
    this.editSessions.delete(sessionKey);
    
    // Broadcast to room (except sender)
    const roomName = this.getRoomName(data.restaurantId);
    socket.to(roomName).emit('menu:updated', event);
    
    logger.info('Menu update broadcast', {
      type: data.type,
      entityType: data.entityType,
      entityId: data.entityId,
      userId: data.userId
    });
  }

  /**
   * Handle cursor position for collaborative editing
   */
  private handleCursorPosition(
    socket: Socket,
    data: {
      restaurantId: string;
      userId: string;
      userName: string;
      field: string;
      position: number;
    }
  ): void {
    const roomName = this.getRoomName(data.restaurantId);
    socket.to(roomName).emit('menu:cursor:update', {
      userId: data.userId,
      userName: data.userName,
      field: data.field,
      position: data.position,
      timestamp: new Date()
    });
  }

  /**
   * Handle socket disconnection
   */
  private handleDisconnect(socket: Socket): void {
    const { restaurantId, userId, userName } = socket.data || {};
    
    if (restaurantId && userId) {
      // End all edit sessions for this user
      this.endAllUserEditSessions(userId, restaurantId);
      
      // Remove from user sockets tracking
      const userSocketSet = this.userSockets.get(userId);
      if (userSocketSet) {
        userSocketSet.delete(socket.id);
        if (userSocketSet.size === 0) {
          this.userSockets.delete(userId);
          
          // Notify room that user left
          const roomName = this.getRoomName(restaurantId);
          this.io?.to(roomName).emit('menu:user:left', {
            userId,
            userName,
            timestamp: new Date()
          });
        }
      }
    }
    
    logger.info('Menu collaboration client disconnected', { socketId: socket.id });
  }

  /**
   * End all edit sessions for a user in a restaurant
   */
  private endAllUserEditSessions(userId: string, restaurantId: string): void {
    const sessionsToEnd: string[] = [];
    
    for (const [key, session] of this.editSessions) {
      if (session.userId === userId && session.restaurantId === restaurantId) {
        sessionsToEnd.push(key);
      }
    }
    
    for (const key of sessionsToEnd) {
      const session = this.editSessions.get(key);
      this.editSessions.delete(key);
      
      if (session) {
        const roomName = this.getRoomName(restaurantId);
        this.io?.to(roomName).emit('menu:edit:ended', {
          itemType: session.itemType,
          itemId: session.itemId,
          userId: session.userId
        });
      }
    }
  }

  /**
   * Get all active edit sessions for a restaurant
   */
  private getActiveEditSessions(restaurantId: string): MenuEditSession[] {
    const sessions: MenuEditSession[] = [];
    
    for (const session of this.editSessions.values()) {
      if (session.restaurantId === restaurantId) {
        sessions.push(session);
      }
    }
    
    return sessions;
  }

  /**
   * Get room name for a restaurant
   */
  private getRoomName(restaurantId: string): string {
    return `menu:${restaurantId}`;
  }

  /**
   * Broadcast a menu update from the server (not from a socket)
   */
  broadcastMenuUpdate(event: Omit<MenuUpdateEvent, 'timestamp'>): void {
    if (!this.io) {
      logger.warn('Cannot broadcast menu update: Socket.IO not initialized');
      return;
    }
    
    const roomName = this.getRoomName(event.restaurantId);
    const fullEvent: MenuUpdateEvent = {
      ...event,
      timestamp: new Date()
    };
    
    this.io.to(roomName).emit('menu:updated', fullEvent);
    
    logger.info('Menu update broadcast from server', {
      type: event.type,
      entityType: event.entityType,
      entityId: event.entityId
    });
  }

  /**
   * Get online users for a restaurant
   */
  getOnlineUsers(restaurantId: string): Array<{ userId: string; userName: string }> {
    const roomName = this.getRoomName(restaurantId);
    const room = this.io?.sockets.adapter.rooms.get(roomName);
    
    if (!room) return [];
    
    const users: Map<string, { userId: string; userName: string }> = new Map();
    
    for (const socketId of room) {
      const socket = this.io?.sockets.sockets.get(socketId);
      if (socket?.data?.userId && socket?.data?.userName) {
        users.set(socket.data.userId, {
          userId: socket.data.userId,
          userName: socket.data.userName
        });
      }
    }
    
    return Array.from(users.values());
  }

  /**
   * Check if an item is being edited
   */
  isItemBeingEdited(
    restaurantId: string,
    itemType: 'category' | 'item' | 'modifier',
    itemId: string
  ): MenuEditSession | null {
    const sessionKey = `${restaurantId}:${itemType}:${itemId}`;
    return this.editSessions.get(sessionKey) || null;
  }
}

// Export singleton instance
export const menuCollaborationService = new MenuCollaborationService();

export type { MenuEditSession, MenuUpdateEvent };
export default menuCollaborationService;
