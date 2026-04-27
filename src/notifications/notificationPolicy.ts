import type { NotificationEventType } from './types';

export type NotificationChannel = 'in_app' | 'push' | 'email' | 'sms';

const POLICY: Record<NotificationEventType, NotificationChannel[]> = {
  'staff.clock_in': ['in_app'],
  'staff.clock_out': ['in_app'],
  'staff.break_start': ['in_app'],
  'staff.break_end': ['in_app'],
  'staff.open_shift_detected': ['in_app', 'push'],
  'order.created_web': ['in_app'],
  'order.created_vapi': ['in_app'],
  'order.status_changed': ['in_app'],
  'receipt.uploaded': ['in_app'],
  'receipt.applied': ['in_app'],
  'inventory.low_stock': ['in_app', 'push'],
  'task.created': ['in_app', 'email'],
  'task.completed': ['in_app', 'email'],
  'system.error': ['in_app', 'push', 'email', 'sms'],
  'system.warning': ['in_app', 'push']
};

export function getChannelsForEvent(type: NotificationEventType): NotificationChannel[] {
  return POLICY[type] ?? ['in_app'];
}

export function supportsChannel(type: NotificationEventType, channel: NotificationChannel): boolean {
  return getChannelsForEvent(type).includes(channel);
}
