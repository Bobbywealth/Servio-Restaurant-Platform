"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationDispatcher = void 0;
class NotificationDispatcher {
    constructor(io) {
        this.io = io;
    }
    emitToRestaurant(restaurantId, payload) {
        this.io.to(`restaurant-${restaurantId}`).emit('notifications.new', payload);
    }
    emitUnreadCountToUser(userId, unreadCount) {
        this.io.to(`user-${userId}`).emit('notifications.unread_count.updated', { unreadCount });
    }
}
exports.NotificationDispatcher = NotificationDispatcher;
//# sourceMappingURL=NotificationDispatcher.js.map