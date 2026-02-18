export type StaffLifecycleNotificationType =
  | 'staff.clock_in'
  | 'staff.clock_out'
  | 'staff.break_start'
  | 'staff.break_end'

export interface NotificationEnvelope {
  notification?: {
    type?: string
  }
}

export interface StaffRefreshActions {
  refreshStaffData: boolean
  refreshHoursData: boolean
}

const STAFF_LIFECYCLE_NOTIFICATION_TYPES: Set<StaffLifecycleNotificationType> = new Set([
  'staff.clock_in',
  'staff.clock_out',
  'staff.break_start',
  'staff.break_end'
])

export function getStaffRefreshActionsFromNotification(
  envelope: NotificationEnvelope
): StaffRefreshActions | null {
  const notificationType = envelope?.notification?.type

  if (!notificationType || !STAFF_LIFECYCLE_NOTIFICATION_TYPES.has(notificationType as StaffLifecycleNotificationType)) {
    return null
  }

  return {
    refreshStaffData: true,
    refreshHoursData: true
  }
}
