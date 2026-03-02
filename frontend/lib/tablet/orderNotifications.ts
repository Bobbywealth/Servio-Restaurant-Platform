export type KnownOrderNotificationType = 'order.created_web' | 'order.created_vapi' | 'order.status_changed';

export type NotificationEventPayload = {
  notification?: {
    type?: string;
  };
};

const HANDLED_NOTIFICATION_TYPES: ReadonlySet<KnownOrderNotificationType> = new Set([
  'order.created_web',
  'order.created_vapi',
  'order.status_changed'
]);

export function shouldRefreshForNotification(
  data: NotificationEventPayload | null | undefined,
  logWarning: (message: string, payload?: unknown) => void = console.warn
): boolean {
  const type = data?.notification?.type;

  if (!type) {
    logWarning('[tablet/orders] Ignoring socket notification with missing type', data);
    return false;
  }

  if (!HANDLED_NOTIFICATION_TYPES.has(type as KnownOrderNotificationType)) {
    logWarning('[tablet/orders] Ignoring socket notification with unknown type', { type });
    return false;
  }

  return true;
}
