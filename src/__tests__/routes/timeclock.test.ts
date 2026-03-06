/**
 * Timeclock Route Tests
 * 
 * Tests for staff time tracking: clock in, clock out, breaks, calculations.
 */

// Shared calculation functions for testing
function calculateHoursWorked(clockIn: Date, clockOut: Date, breakMinutes: number = 0): number {
  const diffMs = clockOut.getTime() - clockIn.getTime();
  const hours = diffMs / (1000 * 60 * 60);
  return hours - (breakMinutes / 60);
}

function calculateWeeklyHours(timeEntries: Array<{clockIn: Date, clockOut: Date, breakMinutes: number}>): number {
  return timeEntries.reduce((total, entry) => {
    const hours = calculateHoursWorked(entry.clockIn, entry.clockOut, entry.breakMinutes);
    return total + hours;
  }, 0);
}

describe('Timeclock Calculations', () => {
  describe('calculateHoursWorked', () => {
    it('should calculate 8 hours for 9-5 shift', () => {
      const clockIn = new Date('2024-01-15T09:00:00Z');
      const clockOut = new Date('2024-01-15T17:00:00Z');
      
      const hours = calculateHoursWorked(clockIn, clockOut);
      expect(hours).toBe(8);
    });

    it('should subtract break time from hours', () => {
      const clockIn = new Date('2024-01-15T09:00:00Z');
      const clockOut = new Date('2024-01-15T17:30:00Z');
      const breakMinutes = 30;
      
      const hours = calculateHoursWorked(clockIn, clockOut, breakMinutes);
      expect(hours).toBe(8);
    });

    it('should handle overnight shifts', () => {
      const clockIn = new Date('2024-01-15T22:00:00Z');
      const clockOut = new Date('2024-01-16T06:00:00Z');
      
      const hours = calculateHoursWorked(clockIn, clockOut);
      expect(hours).toBe(8);
    });

    it('should return negative for invalid clock out before clock in', () => {
      const clockIn = new Date('2024-01-15T17:00:00Z');
      const clockOut = new Date('2024-01-15T09:00:00Z');
      
      const hours = calculateHoursWorked(clockIn, clockOut);
      expect(hours).toBeLessThan(0);
    });
  });

  describe('calculateWeeklyHours', () => {
    it('should sum hours from multiple time entries', () => {
      const timeEntries = [
        { clockIn: new Date('2024-01-15T09:00:00Z'), clockOut: new Date('2024-01-15T17:00:00Z'), breakMinutes: 30 },
        { clockIn: new Date('2024-01-16T09:00:00Z'), clockOut: new Date('2024-01-16T17:00:00Z'), breakMinutes: 30 }
      ];
      
      const weeklyHours = calculateWeeklyHours(timeEntries);
      expect(weeklyHours).toBe(15); // 16 hours - 1 hour breaks = 15
    });

    it('should return 0 for empty time entries', () => {
      const weeklyHours = calculateWeeklyHours([]);
      expect(weeklyHours).toBe(0);
    });
  });
});

describe('Timeclock Status', () => {
  type ClockStatus = 'clocked_out' | 'on_break' | 'clocked_in';

  function getStatus(timeEntry: any): ClockStatus {
    if (!timeEntry) return 'clocked_out';
    if (timeEntry.breakStart && !timeEntry.breakEnd) return 'on_break';
    if (timeEntry.clockIn && !timeEntry.clockOut) return 'clocked_in';
    return 'clocked_out';
  }

  it('should return clocked_out for null entry', () => {
    expect(getStatus(null)).toBe('clocked_out');
  });

  it('should return clocked_in when clocked in but not out', () => {
    const entry = { clockIn: new Date(), clockOut: null };
    expect(getStatus(entry)).toBe('clocked_in');
  });

  it('should return on_break when break started but not ended', () => {
    const entry = { 
      clockIn: new Date(), 
      clockOut: null,
      breakStart: new Date(),
      breakEnd: null
    };
    expect(getStatus(entry)).toBe('on_break');
  });

  it('should return clocked_out when clocked out', () => {
    const entry = { 
      clockIn: new Date(), 
      clockOut: new Date()
    };
    expect(getStatus(entry)).toBe('clocked_out');
  });
});

describe('PIN Validation', () => {
  function validatePin(pin: string): boolean {
    return /^\d{4}$/.test(pin);
  }

  it('should accept valid 4-digit PIN', () => {
    expect(validatePin('1234')).toBe(true);
    expect(validatePin('0000')).toBe(true);
    expect(validatePin('9999')).toBe(true);
  });

  it('should reject PINs with letters', () => {
    expect(validatePin('12a4')).toBe(false);
  });

  it('should reject PINs with special characters', () => {
    expect(validatePin('1234!')).toBe(false);
  });

  it('should reject PINs that are too short', () => {
    expect(validatePin('123')).toBe(false);
  });

  it('should reject PINs that are too long', () => {
    expect(validatePin('12345')).toBe(false);
  });
});

describe('Overtime Calculation', () => {
  const OVERTIME_THRESHOLD = 40;

  function calculateOvertime(weeklyHours: number): number {
    return Math.max(0, weeklyHours - OVERTIME_THRESHOLD);
  }

  it('should return 0 for 40 hours or less', () => {
    expect(calculateOvertime(40)).toBe(0);
    expect(calculateOvertime(35)).toBe(0);
  });

  it('should calculate overtime correctly', () => {
    expect(calculateOvertime(45)).toBe(5);
    expect(calculateOvertime(50)).toBe(10);
  });
});

describe('Manager Override Validation', () => {
  function validateManagerOverride(managerRole: string, action: string): boolean {
    const allowedOverrides: Record<string, string[]> = {
      'manager': ['clock_in', 'clock_out', 'edit_entry', 'delete_entry', 'reverse_entry'],
      'admin': ['clock_in', 'clock_out', 'edit_entry', 'delete_entry', 'reverse_entry', 'view_all']
    };

    return allowedOverrides[managerRole]?.includes(action) ?? false;
  }

  it('should allow manager to clock in other staff', () => {
    expect(validateManagerOverride('manager', 'clock_in')).toBe(true);
  });

  it('should allow manager to reverse entries', () => {
    expect(validateManagerOverride('manager', 'reverse_entry')).toBe(true);
  });

  it('should allow admin to view all staff time', () => {
    expect(validateManagerOverride('admin', 'view_all')).toBe(true);
  });

  it('should not allow staff to perform overrides', () => {
    expect(validateManagerOverride('staff', 'edit_entry')).toBe(false);
  });
});
