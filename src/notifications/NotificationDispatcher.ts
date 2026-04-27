import { Server as IOServer } from 'socket.io';
import { PushService } from '../services/PushService';
import { DatabaseService, DbClient } from '../services/DatabaseService';
import { EmailService } from '../services/EmailService';
import { SmsService } from '../services/SmsService';
import { logger } from '../utils/logger';
import type { NotificationDraft } from './templates';
import type { NotificationEventType, Recipient } from './types';
import { supportsChannel } from './notificationPolicy';

interface DispatchNotification {
  id: string;
  type: NotificationEventType;
  severity: string;
  title: string;
  message: string;
  metadata?: Record<string, any>;
}

interface RecipientUser {
  id: string;
  email: string | null;
  phone: string | null;
}

export class NotificationDispatcher {
  private io: IOServer;
  private pushService: PushService | null = null;
  private emailService = EmailService.getInstance();
  private smsService = SmsService.getInstance();
  private db: DbClient;

  constructor(io: IOServer) {
    this.io = io;
    this.db = DatabaseService.getInstance().getDatabase();
  }

  private shouldSendPush(payload: any): boolean {
    const severity = payload?.severity ?? payload?.notification?.severity;
    return severity === 'high' || severity === 'critical';
  }

  private getPushService(): PushService | null {
    if (!this.pushService) {
      try {
        this.pushService = new PushService(this.db);
      } catch (error) {
        console.warn('PushService not available:', error);
        return null;
      }
    }
    return this.pushService;
  }

  private async resolveRecipients(restaurantId: string, recipients: Recipient[]): Promise<RecipientUser[]> {
    const resolved = new Map<string, RecipientUser>();

    for (const recipient of recipients) {
      let users: RecipientUser[] = [];

      if (recipient.kind === 'restaurant') {
        users = await this.db.all<RecipientUser>(
          'SELECT id, email, phone FROM users WHERE restaurant_id = ? AND is_active = 1',
          [restaurantId]
        );
      } else if (recipient.kind === 'role') {
        users = await this.db.all<RecipientUser>(
          'SELECT id, email, phone FROM users WHERE restaurant_id = ? AND role = ? AND is_active = 1',
          [restaurantId, recipient.role]
        );
      } else {
        users = await this.db.all<RecipientUser>(
          'SELECT id, email, phone FROM users WHERE id = ? AND restaurant_id = ? AND is_active = 1',
          [recipient.userId, restaurantId]
        );
      }

      for (const user of users) {
        resolved.set(user.id, user);
      }
    }

    return [...resolved.values()];
  }

  private shouldSendEmail(
    eventType: NotificationEventType,
    prefs: Awaited<ReturnType<PushService['getNotificationPreferences']>>
  ): boolean {
    if (!prefs || !prefs.emailEnabled) {
      return false;
    }

    if (eventType === 'task.created') {
      return prefs.taskNotifications;
    }

    if (eventType === 'task.completed') {
      return prefs.taskNotifications && prefs.taskCompletedEmail;
    }

    if (eventType === 'system.error') {
      return prefs.criticalAlertsEmail;
    }

    return false;
  }

  private async sendEmail(
    eventType: NotificationEventType,
    user: RecipientUser,
    notification: DispatchNotification
  ): Promise<void> {
    if (!user.email) return;

    const metadata = notification.metadata || {};
    const targetPath = typeof metadata.targetPath === 'string' ? metadata.targetPath : '/dashboard';
    const appUrl = process.env.APP_URL || process.env.FRONTEND_URL || 'http://localhost:3000';
    const actionUrl = `${appUrl}${targetPath}`;

    let subject = `[Servio] ${notification.title}`;
    let text = `${notification.message}\n\nView: ${actionUrl}`;

    if (eventType === 'task.created') {
      subject = `[Servio] New task assigned`;
      text = `A task was created: ${metadata.title || notification.message}\n\nOpen task: ${actionUrl}`;
    } else if (eventType === 'task.completed') {
      subject = `[Servio] Task completed`;
      text = `A task was completed: ${metadata.title || notification.message}\n\nReview task: ${actionUrl}`;
    } else if (eventType === 'system.error') {
      subject = `[Servio] CRITICAL system alert`;
      text = `${notification.message}\n\nThis is a critical alert.\n\nInvestigate: ${actionUrl}`;
    }

    try {
      await this.emailService.sendMail({
        to: user.email,
        subject,
        text
      });
    } catch (error) {
      logger.warn('Failed to send email notification', {
        eventType,
        userId: user.id,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  async dispatchByPolicy(
    restaurantId: string,
    eventType: NotificationEventType,
    draft: NotificationDraft,
    notification: DispatchNotification
  ): Promise<void> {
    const pushService = this.getPushService();

    if (supportsChannel(eventType, 'in_app')) {
      this.emitToRestaurant(restaurantId, { restaurantId, notification }, { allowPush: false });
    }

    const users = await this.resolveRecipients(restaurantId, draft.recipients);

    for (const user of users) {
      const prefs = pushService
        ? await pushService.getNotificationPreferences(user.id)
        : null;

      if (pushService && supportsChannel(eventType, 'push') && prefs?.pushEnabled && this.shouldSendPush(notification)) {
        const inQuietHours = pushService.isInQuietHours(prefs);
        if (!inQuietHours) {
          await pushService.sendNotification(user.id, restaurantId, notification);
        }
      }

      if (supportsChannel(eventType, 'email') && this.shouldSendEmail(eventType, prefs)) {
        await this.sendEmail(eventType, user, notification);
      }

      if (supportsChannel(eventType, 'sms') && prefs?.smsEnabled && user.phone && eventType === 'system.error') {
        await this.smsService.sendSms(user.phone, `[Servio Critical] ${notification.message}`);
      }
    }
  }

  emitToRestaurant(restaurantId: string, payload: any, options?: { allowPush?: boolean }) {
    this.io.to(`restaurant-${restaurantId}`).emit('notifications.new', payload);

    if (options?.allowPush === false) return;

    const pushService = this.getPushService();
    if (pushService && this.shouldSendPush(payload)) {
      pushService.sendNotification(
        null,
        restaurantId,
        payload
      ).catch(err => {
        console.warn('Failed to send push notification:', err);
      });
    }
  }

  emitToUser(userId: string, payload: any) {
    this.io.to(`user-${userId}`).emit('notifications.new', payload);

    const pushService = this.getPushService();
    if (pushService && this.shouldSendPush(payload)) {
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
