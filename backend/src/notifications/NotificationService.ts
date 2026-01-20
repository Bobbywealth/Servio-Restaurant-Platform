import type { EventBus } from '../events/EventBus';
import type { DomainEvent, NotificationEventType } from './types';
import { buildNotificationDraft } from './templates';
import { NotificationStore } from './NotificationStore';
import { NotificationDispatcher } from './NotificationDispatcher';

const handledEvents: NotificationEventType[] = [
  'staff.clock_in',
  'staff.clock_out',
  'staff.break_start',
  'staff.break_end',
  'staff.open_shift_detected',
  'order.created_web',
  'order.created_vapi',
  'order.status_changed',
  'receipt.uploaded',
  'receipt.applied',
  'inventory.low_stock',
  'task.created',
  'task.completed',
  'system.error',
  'system.warning'
];

export class NotificationService {
  constructor(
    private bus: EventBus,
    private store: NotificationStore,
    private dispatcher: NotificationDispatcher
  ) {}

  register() {
    for (const type of handledEvents) {
      this.bus.on(type, async (event: DomainEvent) => {
        const drafts = buildNotificationDraft(event);
        for (const draft of drafts) {
          const { notificationId, createdAt } = await this.store.createNotification(
            event.restaurantId,
            event.type,
            draft
          );

          this.dispatcher.emitToRestaurant(event.restaurantId, {
            restaurantId: event.restaurantId,
            notification: {
              id: notificationId,
              type: event.type,
              severity: draft.severity,
              title: draft.title,
              message: draft.message,
              metadata: draft.metadata ?? {},
              createdAt,
              isRead: false
            }
          });
        }
      });
    }
  }
}
