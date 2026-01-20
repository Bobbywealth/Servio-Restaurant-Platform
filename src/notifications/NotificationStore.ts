import { v4 as uuidv4 } from 'uuid';
import type { DbClient } from '../services/DatabaseService';
import type { NotificationDraft } from './templates';
import type { Recipient } from './types';

export class NotificationStore {
  constructor(private db: DbClient) {}

  private serializeMetadata(metadata?: Record<string, any>): string {
    if (!metadata) return '{}';
    try {
      return JSON.stringify(metadata);
    } catch {
      return '{}';
    }
  }

  private async insertRecipients(notificationId: string, restaurantId: string, recipients: Recipient[]) {
    for (const recipient of recipients) {
      const recipientId = uuidv4();
      if (recipient.kind === 'restaurant') {
        await this.db.run(
          `INSERT INTO notification_recipients (
            id, notification_id, recipient_type, restaurant_id
          ) VALUES (?, ?, 'restaurant', ?)`,
          [recipientId, notificationId, restaurantId]
        );
      } else if (recipient.kind === 'role') {
        await this.db.run(
          `INSERT INTO notification_recipients (
            id, notification_id, recipient_type, recipient_role, restaurant_id
          ) VALUES (?, ?, 'role', ?, ?)`,
          [recipientId, notificationId, recipient.role, restaurantId]
        );
      } else {
        await this.db.run(
          `INSERT INTO notification_recipients (
            id, notification_id, recipient_type, recipient_user_id, restaurant_id
          ) VALUES (?, ?, 'user', ?, ?)`,
          [recipientId, notificationId, recipient.userId, restaurantId]
        );
      }
    }
  }

  async createNotification(restaurantId: string, type: string, draft: NotificationDraft) {
    const notificationId = uuidv4();
    await this.db.run(
      `INSERT INTO notifications (
        id, restaurant_id, type, severity, title, message, metadata, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      [
        notificationId,
        restaurantId,
        type,
        draft.severity,
        draft.title,
        draft.message,
        this.serializeMetadata(draft.metadata)
      ]
    );

    await this.insertRecipients(notificationId, restaurantId, draft.recipients);

    return { notificationId, createdAt: new Date().toISOString() };
  }
}
