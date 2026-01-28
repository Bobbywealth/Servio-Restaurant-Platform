import webPush from 'web-push';
import { v4 as uuidv4 } from 'uuid';
import { DbClient } from './DatabaseService';
import { logger } from '../utils/logger';

// Configure VAPID details from environment variables
const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
const vapidEmail = process.env.VAPID_EMAIL || 'mailto:admin@servio.com';

if (vapidPublicKey && vapidPrivateKey) {
  webPush.setVapidDetails(vapidEmail, vapidPublicKey, vapidPrivateKey);
} else {
  logger.warn('VAPID keys not configured. Push notifications will not work.');
}

export interface PushSubscriptionData {
  endpoint: string;
  keys?: {
    p256dh: string;
    auth: string;
  };
}

export interface PushNotificationPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  data?: Record<string, any>;
  actions?: Array<{ action: string; title: string; icon?: string }>;
  requireInteraction?: boolean;
  vibrate?: number[];
}

export class PushService {
  private db: DbClient;
  private vapidPublicKey: string;

  constructor(db: DbClient) {
    this.db = db;
    this.vapidPublicKey = vapidPublicKey || '';
  }

  getVapidPublicKey(): string {
    return this.vapidPublicKey;
  }

  /**
   * Subscribe a user to push notifications
   */
  async subscribe(
    userId: string,
    restaurantId: string,
    subscription: PushSubscriptionData
  ): Promise<{ id: string; success: boolean }> {
    try {
      const id = uuidv4();
      const endpoint = subscription.endpoint;

      // Check if subscription already exists for this endpoint
      const existing = await this.db.get<{ id: string }>(
        'SELECT id FROM push_subscriptions WHERE endpoint = ? AND is_active = 1',
        [endpoint]
      );

      if (existing) {
        // Update existing subscription
        await this.db.run(
          `UPDATE push_subscriptions
           SET user_id = ?, restaurant_id = ?, subscription_data = ?, updated_at = datetime('now'), is_active = 1
           WHERE id = ?`,
          [userId, restaurantId, JSON.stringify(subscription), existing.id]
        );
        logger.info(`Updated push subscription for user ${userId}`);
        return { id: existing.id, success: true };
      }

      // Insert new subscription
      await this.db.run(
        `INSERT INTO push_subscriptions (id, user_id, restaurant_id, subscription_data, endpoint)
         VALUES (?, ?, ?, ?, ?)`,
        [id, userId, restaurantId, JSON.stringify(subscription), endpoint]
      );

      logger.info(`Created push subscription ${id} for user ${userId}`);
      return { id, success: true };
    } catch (error) {
      logger.error('Failed to subscribe to push notifications:', error);
      return { id: '', success: false };
    }
  }

  /**
   * Unsubscribe from push notifications
   */
  async unsubscribe(subscriptionId: string): Promise<boolean> {
    try {
      await this.db.run(
        'UPDATE push_subscriptions SET is_active = 0, updated_at = datetime(\'now\') WHERE id = ?',
        [subscriptionId]
      );
      logger.info(`Unsubscribed push subscription ${subscriptionId}`);
      return true;
    } catch (error) {
      logger.error('Failed to unsubscribe from push notifications:', error);
      return false;
    }
  }

  /**
   * Unsubscribe all subscriptions for a user
   */
  async unsubscribeAllForUser(userId: string): Promise<boolean> {
    try {
      await this.db.run(
        'UPDATE push_subscriptions SET is_active = 0, updated_at = datetime(\'now\') WHERE user_id = ?',
        [userId]
      );
      logger.info(`Unsubscribed all push subscriptions for user ${userId}`);
      return true;
    } catch (error) {
      logger.error('Failed to unsubscribe user from push notifications:', error);
      return false;
    }
  }

  /**
   * Get all active subscriptions for a restaurant
   */
  async getSubscriptionsForRestaurant(restaurantId: string): Promise<PushSubscriptionData[]> {
    try {
      const rows = await this.db.all<{ subscription_data: string }>(
        'SELECT subscription_data FROM push_subscriptions WHERE restaurant_id = ? AND is_active = 1',
        [restaurantId]
      );
      return rows.map(row => JSON.parse(row.subscription_data));
    } catch (error) {
      logger.error('Failed to get push subscriptions for restaurant:', error);
      return [];
    }
  }

  /**
   * Get all active subscriptions for a user
   */
  async getSubscriptionsForUser(userId: string): Promise<PushSubscriptionData[]> {
    try {
      const rows = await this.db.all<{ subscription_data: string }>(
        'SELECT subscription_data FROM push_subscriptions WHERE user_id = ? AND is_active = 1',
        [userId]
      );
      return rows.map(row => JSON.parse(row.subscription_data));
    } catch (error) {
      logger.error('Failed to get push subscriptions for user:', error);
      return [];
    }
  }

  /**
   * Send a push notification to all users in a restaurant
   */
  async sendToRestaurant(restaurantId: string, payload: PushNotificationPayload): Promise<number> {
    const subscriptions = await this.getSubscriptionsForRestaurant(restaurantId);
    if (subscriptions.length === 0) {
      logger.debug(`No active push subscriptions for restaurant ${restaurantId}`);
      return 0;
    }

    const payloadString = JSON.stringify({
      title: payload.title,
      body: payload.body,
      icon: payload.icon || '/icons/servio-icon-192.svg',
      badge: payload.badge || '/icons/servio-icon-192.svg',
      tag: payload.tag,
      data: payload.data,
      actions: payload.actions || [
        { action: 'view', title: 'View' },
        { action: 'dismiss', title: 'Dismiss' }
      ],
      requireInteraction: payload.requireInteraction ?? (payload.tag === 'critical'),
      vibrate: payload.vibrate || [200, 100, 200]
    });

    let successCount = 0;
    let failureCount = 0;

    await Promise.all(
      subscriptions.map(async (subscription) => {
        try {
          await webPush.sendNotification(subscription, payloadString);
          successCount++;
        } catch (error: any) {
          failureCount++;
          // Handle subscription expiration (410 Gone)
          if (error.statusCode === 410) {
            await this.removeExpiredSubscription(subscription.endpoint);
          }
          logger.warn(`Push notification failed for endpoint: ${error.message}`);
        }
      })
    );

    logger.info(`Push notifications sent to restaurant ${restaurantId}: ${successCount} success, ${failureCount} failed`);
    return successCount;
  }

  /**
   * Send a push notification to a specific user
   */
  async sendToUser(userId: string, payload: PushNotificationPayload): Promise<number> {
    const subscriptions = await this.getSubscriptionsForUser(userId);
    if (subscriptions.length === 0) {
      logger.debug(`No active push subscriptions for user ${userId}`);
      return 0;
    }

    const payloadString = JSON.stringify({
      title: payload.title,
      body: payload.body,
      icon: payload.icon || '/icons/servio-icon-192.svg',
      badge: payload.badge || '/icons/servio-icon-192.svg',
      tag: payload.tag,
      data: payload.data,
      actions: payload.actions || [
        { action: 'view', title: 'View' },
        { action: 'dismiss', title: 'Dismiss' }
      ],
      requireInteraction: payload.requireInteraction ?? (payload.tag === 'critical'),
      vibrate: payload.vibrate || [200, 100, 200]
    });

    let successCount = 0;
    let failureCount = 0;

    await Promise.all(
      subscriptions.map(async (subscription) => {
        try {
          await webPush.sendNotification(subscription, payloadString);
          successCount++;
        } catch (error: any) {
          failureCount++;
          // Handle subscription expiration (410 Gone)
          if (error.statusCode === 410) {
            await this.removeExpiredSubscription(subscription.endpoint);
          }
          logger.warn(`Push notification failed for user ${userId}: ${error.message}`);
        }
      })
    );

    logger.info(`Push notifications sent to user ${userId}: ${successCount} success, ${failureCount} failed`);
    return successCount;
  }

  /**
   * Remove an expired subscription
   */
  private async removeExpiredSubscription(endpoint: string): Promise<void> {
    try {
      await this.db.run(
        'UPDATE push_subscriptions SET is_active = 0, updated_at = datetime(\'now\') WHERE endpoint = ?',
        [endpoint]
      );
      logger.debug(`Marked expired subscription as inactive: ${endpoint}`);
    } catch (error) {
      logger.error('Failed to remove expired subscription:', error);
    }
  }

  /**
   * Send a notification based on notification center data
   */
  async sendNotification(
    userId: string | null,
    restaurantId: string,
    notification: {
      id: string;
      type: string;
      severity: string;
      title: string;
      message: string;
      metadata?: Record<string, any>;
    }
  ): Promise<void> {
    // Only send push for high priority notifications
    if (notification.severity !== 'high' && notification.severity !== 'critical') {
      return;
    }

    const payload: PushNotificationPayload = {
      title: notification.title,
      body: notification.message,
      tag: `${notification.type}-${notification.id}`,
      data: {
        id: notification.id,
        type: notification.type,
        ...notification.metadata
      },
      requireInteraction: notification.severity === 'critical'
    };

    if (userId) {
      await this.sendToUser(userId, payload);
    } else {
      await this.sendToRestaurant(restaurantId, payload);
    }
  }

  /**
   * Get notification preferences for a user
   */
  async getNotificationPreferences(userId: string): Promise<{
    pushEnabled: boolean;
    orderNotifications: boolean;
    staffNotifications: boolean;
    inventoryNotifications: boolean;
    taskNotifications: boolean;
    quietHoursEnabled: boolean;
    quietHoursStart: string;
    quietHoursEnd: string;
  } | null> {
    try {
      const prefs = await this.db.get<any>(
        'SELECT * FROM notification_preferences WHERE user_id = ?',
        [userId]
      );

      if (!prefs) {
        // Return defaults
        return {
          pushEnabled: true,
          orderNotifications: true,
          staffNotifications: true,
          inventoryNotifications: true,
          taskNotifications: true,
          quietHoursEnabled: false,
          quietHoursStart: '22:00',
          quietHoursEnd: '07:00'
        };
      }

      return {
        pushEnabled: prefs.push_enabled === 1,
        orderNotifications: prefs.order_notifications === 1,
        staffNotifications: prefs.staff_notifications === 1,
        inventoryNotifications: prefs.inventory_notifications === 1,
        taskNotifications: prefs.task_notifications === 1,
        quietHoursEnabled: prefs.quiet_hours_enabled === 1,
        quietHoursStart: prefs.quiet_hours_start || '22:00',
        quietHoursEnd: prefs.quiet_hours_end || '07:00'
      };
    } catch (error) {
      logger.error('Failed to get notification preferences:', error);
      return null;
    }
  }

  /**
   * Update notification preferences for a user
   */
  async updateNotificationPreferences(
    userId: string,
    preferences: Partial<{
      pushEnabled: boolean;
      orderNotifications: boolean;
      staffNotifications: boolean;
      inventoryNotifications: boolean;
      taskNotifications: boolean;
      quietHoursEnabled: boolean;
      quietHoursStart: string;
      quietHoursEnd: string;
    }>
  ): Promise<boolean> {
    try {
      const existing = await this.db.get<{ id: string }>(
        'SELECT id FROM notification_preferences WHERE user_id = ?',
        [userId]
      );

      if (existing) {
        // Update existing preferences
        const updates: string[] = [];
        const params: any[] = [];

        if (preferences.pushEnabled !== undefined) {
          updates.push('push_enabled = ?');
          params.push(preferences.pushEnabled ? 1 : 0);
        }
        if (preferences.orderNotifications !== undefined) {
          updates.push('order_notifications = ?');
          params.push(preferences.orderNotifications ? 1 : 0);
        }
        if (preferences.staffNotifications !== undefined) {
          updates.push('staff_notifications = ?');
          params.push(preferences.staffNotifications ? 1 : 0);
        }
        if (preferences.inventoryNotifications !== undefined) {
          updates.push('inventory_notifications = ?');
          params.push(preferences.inventoryNotifications ? 1 : 0);
        }
        if (preferences.taskNotifications !== undefined) {
          updates.push('task_notifications = ?');
          params.push(preferences.taskNotifications ? 1 : 0);
        }
        if (preferences.quietHoursEnabled !== undefined) {
          updates.push('quiet_hours_enabled = ?');
          params.push(preferences.quietHoursEnabled ? 1 : 0);
        }
        if (preferences.quietHoursStart !== undefined) {
          updates.push('quiet_hours_start = ?');
          params.push(preferences.quietHoursStart);
        }
        if (preferences.quietHoursEnd !== undefined) {
          updates.push('quiet_hours_end = ?');
          params.push(preferences.quietHoursEnd);
        }

        updates.push('updated_at = datetime(\'now\')');
        params.push(userId);

        await this.db.run(
          `UPDATE notification_preferences SET ${updates.join(', ')} WHERE user_id = ?`,
          params
        );
      } else {
        // Insert new preferences
        const id = uuidv4();
        await this.db.run(
          `INSERT INTO notification_preferences (
            id, user_id, push_enabled, order_notifications, staff_notifications,
            inventory_notifications, task_notifications, quiet_hours_enabled,
            quiet_hours_start, quiet_hours_end
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            id,
            userId,
            preferences.pushEnabled !== false ? 1 : 0,
            preferences.orderNotifications !== false ? 1 : 0,
            preferences.staffNotifications !== false ? 1 : 0,
            preferences.inventoryNotifications !== false ? 1 : 0,
            preferences.taskNotifications !== false ? 1 : 0,
            preferences.quietHoursEnabled ? 1 : 0,
            preferences.quietHoursStart || '22:00',
            preferences.quietHoursEnd || '07:00'
          ]
        );
      }

      logger.info(`Updated notification preferences for user ${userId}`);
      return true;
    } catch (error) {
      logger.error('Failed to update notification preferences:', error);
      return false;
    }
  }

  /**
   * Check if user is in quiet hours
   */
  isInQuietHours(prefs: {
    quietHoursEnabled: boolean;
    quietHoursStart: string;
    quietHoursEnd: string;
  }): boolean {
    if (!prefs.quietHoursEnabled) {
      return false;
    }

    const now = new Date();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

    const { quietHoursStart, quietHoursEnd } = prefs;

    if (quietHoursStart <= quietHoursEnd) {
      // Normal case: quiet hours within same day (e.g., 09:00 to 17:00)
      return currentTime >= quietHoursStart && currentTime <= quietHoursEnd;
    } else {
      // Overnight case: quiet hours span midnight (e.g., 22:00 to 07:00)
      return currentTime >= quietHoursStart || currentTime <= quietHoursEnd;
    }
  }
}
