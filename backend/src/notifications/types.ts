export type NotificationSeverity = 'info' | 'warning' | 'critical';

export type NotificationEventType =
  | 'staff.clock_in'
  | 'staff.clock_out'
  | 'staff.break_start'
  | 'staff.break_end'
  | 'staff.open_shift_detected'
  | 'order.created_web'
  | 'order.created_vapi'
  | 'order.status_changed'
  | 'receipt.uploaded'
  | 'receipt.applied'
  | 'inventory.low_stock'
  | 'task.created'
  | 'task.completed'
  | 'system.error'
  | 'system.warning';

export type Recipient =
  | { kind: 'restaurant' }
  | { kind: 'role'; role: 'owner' | 'manager' | 'staff' | 'admin' | 'platform-admin' }
  | { kind: 'user'; userId: string };

export interface DomainEvent<TPayload = any> {
  restaurantId: string;
  type: NotificationEventType;
  actor?: { actorType: 'user' | 'assistant' | 'vapi' | 'system'; actorId?: string };
  payload: TPayload;
  occurredAt?: string;
}
