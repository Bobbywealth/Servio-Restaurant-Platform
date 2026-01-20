import type { DomainEvent, Recipient, NotificationSeverity } from './types';

export interface NotificationDraft {
  severity: NotificationSeverity;
  title: string;
  message: string;
  metadata?: Record<string, any>;
  recipients: Recipient[];
}

function restaurantWide(): Recipient[] {
  return [{ kind: 'restaurant' }];
}

export function buildNotificationDraft(event: DomainEvent): NotificationDraft[] {
  const { type, payload } = event;

  switch (type) {
    case 'staff.clock_in':
      return [{
        severity: 'info',
        title: 'Staff Clock In',
        message: `${payload.staffName ?? 'Staff member'} clocked in.`,
        metadata: { staffId: payload.staffId, timeEntryId: payload.timeEntryId, position: payload.position },
        recipients: [{ kind: 'role', role: 'owner' }, { kind: 'role', role: 'manager' }]
      }];

    case 'staff.clock_out':
      return [{
        severity: 'info',
        title: 'Staff Clock Out',
        message: `${payload.staffName ?? 'Staff member'} clocked out.`,
        metadata: { staffId: payload.staffId, timeEntryId: payload.timeEntryId, totalHours: payload.totalHours },
        recipients: [{ kind: 'role', role: 'owner' }, { kind: 'role', role: 'manager' }]
      }];

    case 'staff.break_start':
      return [{
        severity: 'info',
        title: 'Break Started',
        message: `${payload.staffName ?? 'Staff member'} started a break.`,
        metadata: { staffId: payload.staffId, timeEntryId: payload.timeEntryId },
        recipients: [{ kind: 'role', role: 'owner' }, { kind: 'role', role: 'manager' }]
      }];

    case 'staff.break_end':
      return [{
        severity: 'info',
        title: 'Break Ended',
        message: `${payload.staffName ?? 'Staff member'} ended a break.`,
        metadata: { staffId: payload.staffId, timeEntryId: payload.timeEntryId, durationMinutes: payload.durationMinutes },
        recipients: [{ kind: 'role', role: 'owner' }, { kind: 'role', role: 'manager' }]
      }];

    case 'staff.open_shift_detected':
      return [{
        severity: 'warning',
        title: 'Open Shift Detected',
        message: payload.message || 'An open shift needs coverage.',
        metadata: payload,
        recipients: [{ kind: 'role', role: 'owner' }, { kind: 'role', role: 'manager' }]
      }];

    case 'order.created_web':
      return [{
        severity: 'info',
        title: 'New Web Order',
        message: `New order placed${payload.customerName ? ` by ${payload.customerName}` : ''}.`,
        metadata: { orderId: payload.orderId, source: payload.channel || 'web' },
        recipients: restaurantWide()
      }];

    case 'order.created_vapi':
      return [{
        severity: 'info',
        title: 'New Phone Order',
        message: `New phone order placed${payload.customerName ? ` by ${payload.customerName}` : ''}.`,
        metadata: { orderId: payload.orderId, source: 'vapi' },
        recipients: restaurantWide()
      }];

    case 'order.status_changed':
      return [{
        severity: 'info',
        title: 'Order Status Updated',
        message: `Order ${payload.orderId} updated to ${payload.newStatus}.`,
        metadata: { orderId: payload.orderId, previousStatus: payload.previousStatus, newStatus: payload.newStatus },
        recipients: restaurantWide()
      }];

    case 'receipt.uploaded':
      return [{
        severity: 'info',
        title: 'Receipt Uploaded',
        message: payload.supplierName
          ? `Receipt uploaded for ${payload.supplierName}.`
          : 'Receipt uploaded.',
        metadata: { receiptId: payload.receiptId, supplierName: payload.supplierName, totalAmount: payload.totalAmount },
        recipients: [{ kind: 'role', role: 'owner' }, { kind: 'role', role: 'manager' }]
      }];

    case 'receipt.applied':
      return [{
        severity: 'info',
        title: 'Receipt Applied',
        message: `Receipt ${payload.receiptId} applied to inventory.`,
        metadata: { receiptId: payload.receiptId, appliedItemsCount: payload.appliedItemsCount },
        recipients: [{ kind: 'role', role: 'owner' }, { kind: 'role', role: 'manager' }]
      }];

    case 'inventory.low_stock':
      return [{
        severity: 'warning',
        title: 'Low Stock',
        message: `${payload.itemName ?? 'Inventory item'} is low on stock.`,
        metadata: payload,
        recipients: [{ kind: 'role', role: 'owner' }, { kind: 'role', role: 'manager' }]
      }];

    case 'task.created': {
      const recipients: Recipient[] = payload.assignedTo
        ? [{ kind: 'user', userId: payload.assignedTo }]
        : [{ kind: 'role', role: 'manager' }];
      return [{
        severity: 'info',
        title: 'Task Created',
        message: payload.title ? `Task created: ${payload.title}.` : 'New task created.',
        metadata: { taskId: payload.taskId, title: payload.title, assignedTo: payload.assignedTo },
        recipients
      }];
    }

    case 'task.completed':
      return [{
        severity: 'info',
        title: 'Task Completed',
        message: payload.title ? `Task completed: ${payload.title}.` : 'Task completed.',
        metadata: { taskId: payload.taskId, title: payload.title },
        recipients: [{ kind: 'role', role: 'manager' }, { kind: 'role', role: 'owner' }]
      }];

    case 'system.error':
      return [{
        severity: 'critical',
        title: 'System Error',
        message: payload.message || 'An error occurred.',
        metadata: payload,
        recipients: [{ kind: 'role', role: 'owner' }]
      }];

    case 'system.warning':
      return [{
        severity: 'warning',
        title: 'System Warning',
        message: payload.message || 'A warning was reported.',
        metadata: payload,
        recipients: [{ kind: 'role', role: 'owner' }]
      }];

    default:
      return [];
  }
}
