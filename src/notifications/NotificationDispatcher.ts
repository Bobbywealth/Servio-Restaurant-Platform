import { Server as IOServer } from 'socket.io';
import { PushService } from '../services/PushService';
import { DatabaseService, DbClient } from '../services/DatabaseService';

export class NotificationDispatcher {
  private io: IOServer;
  private pushService: PushService | null = null;

  constructor(io: IOServer) {
    this.io = io;
    // Lazy initialization of PushService to avoid issues with database not being ready
  }

  private shouldSendPush(payload: any): boolean {
    const severity = payload?.severity ?? payload?.notification?.severity;
    return severity === 'high' || severity === 'critical';
  }

  private getPushService(): PushService | null {
    if (!this.pushService) {
      try {
        const db: DbClient = DatabaseService.getInstance().getDatabase();
        this.pushService = new PushService(db);
      } catch (error) {
        console.warn('PushService not available:', error);
        return null;
      }
    }
    return this.pushService;
  }

  emitToRestaurant(restaurantId: string, payload: any) {
    this.io.to(`restaurant-${restaurantId}`).emit('notifications.new', payload);

    // Also send push notification for high/critical severity
    const pushService = this.getPushService();
    if (pushService && this.shouldSendPush(payload)) {
      // Fire and forget - don't await
      pushService.sendNotification(
        null, // broadcast to restaurant
        restaurantId,
        payload
      ).catch(err => {
        console.warn('Failed to send push notification:', err);
      });
    }
  }

  emitToUser(userId: string, payload: any) {
    this.io.to(`user-${userId}`).emit('notifications.new', payload);

    // Also send push notification for high/critical severity
    const pushService = this.getPushService();
    if (pushService && this.shouldSendPush(payload)) {
      // Fire and forget - don't await
      pushService.sendNotification(
        userId,
        payload.restaurantId || '',
        payload
      ).catch(err => {
        console.warn('Failed to send push notification to user:', err);
      });
    }
  }

  emitUnreadCountToUser(userId: string, unreadCount: number) {
    this.io.to(`user-${userId}`).emit('notifications.unread_count.updated', { unreadCount });
  }
}
