import { getStaffRefreshActionsFromNotification } from '../../../frontend/lib/staffSocketNotifications';

describe('staff socket notification contract', () => {
  it('triggers staff + hours refresh for break lifecycle notifications', () => {
    const startBreak = getStaffRefreshActionsFromNotification({
      notification: { type: 'staff.break_start' }
    });
    const endBreak = getStaffRefreshActionsFromNotification({
      notification: { type: 'staff.break_end' }
    });

    expect(startBreak).toEqual({ refreshStaffData: true, refreshHoursData: true });
    expect(endBreak).toEqual({ refreshStaffData: true, refreshHoursData: true });
  });

  it('triggers staff + hours refresh for clock lifecycle notifications', () => {
    const clockIn = getStaffRefreshActionsFromNotification({
      notification: { type: 'staff.clock_in' }
    });
    const clockOut = getStaffRefreshActionsFromNotification({
      notification: { type: 'staff.clock_out' }
    });

    expect(clockIn).toEqual({ refreshStaffData: true, refreshHoursData: true });
    expect(clockOut).toEqual({ refreshStaffData: true, refreshHoursData: true });
  });

  it('ignores unrelated notifications', () => {
    const unrelated = getStaffRefreshActionsFromNotification({
      notification: { type: 'order.created_web' }
    });

    expect(unrelated).toBeNull();
  });
});
