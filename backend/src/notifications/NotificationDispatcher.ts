import { Server as IOServer } from 'socket.io';

export class NotificationDispatcher {
  constructor(private io: IOServer) {}

  emitToRestaurant(restaurantId: string, payload: any) {
    this.io.to(`restaurant-${restaurantId}`).emit('notifications.new', payload);
  }

  emitUnreadCountToUser(userId: string, unreadCount: number) {
    this.io.to(`user-${userId}`).emit('notifications.unread_count.updated', { unreadCount });
  }
}
