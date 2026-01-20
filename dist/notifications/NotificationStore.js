"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationStore = void 0;
const uuid_1 = require("uuid");
class NotificationStore {
    constructor(db) {
        this.db = db;
    }
    serializeMetadata(metadata) {
        if (!metadata)
            return '{}';
        try {
            return JSON.stringify(metadata);
        }
        catch {
            return '{}';
        }
    }
    async insertRecipients(notificationId, restaurantId, recipients) {
        for (const recipient of recipients) {
            const recipientId = (0, uuid_1.v4)();
            if (recipient.kind === 'restaurant') {
                await this.db.run(`INSERT INTO notification_recipients (
            id, notification_id, recipient_type, restaurant_id
          ) VALUES (?, ?, 'restaurant', ?)`, [recipientId, notificationId, restaurantId]);
            }
            else if (recipient.kind === 'role') {
                await this.db.run(`INSERT INTO notification_recipients (
            id, notification_id, recipient_type, recipient_role, restaurant_id
          ) VALUES (?, ?, 'role', ?, ?)`, [recipientId, notificationId, recipient.role, restaurantId]);
            }
            else {
                await this.db.run(`INSERT INTO notification_recipients (
            id, notification_id, recipient_type, recipient_user_id, restaurant_id
          ) VALUES (?, ?, 'user', ?, ?)`, [recipientId, notificationId, recipient.userId, restaurantId]);
            }
        }
    }
    async createNotification(restaurantId, type, draft) {
        const notificationId = (0, uuid_1.v4)();
        await this.db.run(`INSERT INTO notifications (
        id, restaurant_id, type, severity, title, message, metadata, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`, [
            notificationId,
            restaurantId,
            type,
            draft.severity,
            draft.title,
            draft.message,
            this.serializeMetadata(draft.metadata)
        ]);
        await this.insertRecipients(notificationId, restaurantId, draft.recipients);
        return { notificationId, createdAt: new Date().toISOString() };
    }
}
exports.NotificationStore = NotificationStore;
//# sourceMappingURL=NotificationStore.js.map