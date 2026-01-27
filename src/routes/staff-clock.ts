import { Router, Request, Response } from 'express';
import { DatabaseService } from '../services/DatabaseService';
import { asyncHandler } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';
import { eventBus } from '../events/bus';

const router = Router();

/**
 * Staff Clock-in PWA API
 * Public PIN-based authentication for staff clock-in/out operations
 * Updated: January 27, 2026
 */

/**
 * POST /api/staff/clock/pin-login
 * Authenticate staff by PIN for PWA clock-in (public - no auth required)
 */
router.post('/pin-login', asyncHandler(async (req: Request, res: Response) => {
  const { pin } = req.body;

  if (!pin || pin.length !== 4) {
    return res.status(400).json({
      success: false,
      error: { message: 'PIN is required and must be 4 digits' }
    });
  }

  const db = DatabaseService.getInstance().getDatabase();

  const user = await db.get(`
    SELECT
      u.id,
      u.name,
      u.email,
      u.role,
      u.restaurant_id,
      u.pin,
      r.name as restaurant_name
    FROM users u
    JOIN restaurants r ON u.restaurant_id = r.id
    WHERE u.pin = ? AND u.is_active = TRUE AND r.is_active = TRUE
  `, [pin]);

  if (!user) {
    return res.status(401).json({
      success: false,
      error: { message: 'Invalid PIN or user inactive' }
    });
  }

  // Get current shift status
  const currentShift = await db.get(`
    SELECT
      te.id as time_entry_id,
      te.clock_in_time,
      te.break_minutes,
      te.position,
      CASE
        WHEN teb.break_end IS NULL THEN 1
        ELSE 0
      END as is_on_break,
      teb.break_start as current_break_start
    FROM time_entries te
    LEFT JOIN time_entry_breaks teb ON te.id = teb.time_entry_id AND teb.break_end IS NULL
    WHERE te.user_id = ? AND te.clock_out_time IS NULL
    ORDER BY te.clock_in_time DESC
    LIMIT 1
  `, [user.id]);

  // Get weekly hours (current week starting Monday)
  const startOfWeek = new Date();
  startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
  startOfWeek.setHours(0, 0, 0, 0);

  const weeklyHours = await db.get(`
    SELECT COALESCE(SUM(total_hours), 0) as total_hours
    FROM time_entries
    WHERE user_id = ? AND clock_out_time IS NOT NULL AND clock_in_time >= ?
  `, [user.id, startOfWeek.toISOString()]);

  res.json({
    success: true,
    data: {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        restaurantId: user.restaurant_id,
        restaurantName: user.restaurant_name,
        pin: user.pin
      },
      currentShift: currentShift ? {
        timeEntryId: currentShift.time_entry_id,
        clockInTime: currentShift.clock_in_time,
        breakMinutes: currentShift.break_minutes,
        position: currentShift.position,
        isOnBreak: Boolean(currentShift.is_on_break),
        currentBreakStart: currentShift.current_break_start
      } : null,
      weeklyHours: Number(weeklyHours.total_hours || 0)
    }
  });
}));

/**
 * POST /api/staff/clock/clock-in
 * Clock in a staff member (public - authenticated by PIN)
 */
router.post('/clock-in', asyncHandler(async (req: Request, res: Response) => {
  const { pin, position } = req.body;

  if (!pin || pin.length !== 4) {
    return res.status(400).json({
      success: false,
      error: { message: 'PIN is required and must be 4 digits' }
    });
  }

  const db = DatabaseService.getInstance().getDatabase();

  const user = await db.get(`
    SELECT * FROM users WHERE pin = ? AND is_active = TRUE
  `, [pin]);

  if (!user) {
    return res.status(404).json({
      success: false,
      error: { message: 'User not found or inactive' }
    });
  }

  // Check if user is already clocked in
  const existingEntry = await db.get(`
    SELECT * FROM time_entries
    WHERE user_id = ? AND clock_out_time IS NULL
    ORDER BY clock_in_time DESC
    LIMIT 1
  `, [user.id]);

  if (existingEntry) {
    return res.status(400).json({
      success: false,
      error: {
        message: 'User is already clocked in',
        clockInTime: existingEntry.clock_in_time
      }
    });
  }

  // Create new time entry
  const entryId = uuidv4();
  const clockInTime = new Date().toISOString();

  await db.run(`
    INSERT INTO time_entries (
      id, restaurant_id, user_id, clock_in_time, position, break_minutes
    ) VALUES (?, ?, ?, ?, ?, ?)
  `, [entryId, user.restaurant_id, user.id, clockInTime, position || null, 0]);

  await DatabaseService.getInstance().logAudit(
    user.restaurant_id,
    user.id,
    'clock_in',
    'time_entry',
    entryId,
    { position, clockInTime }
  );

  await eventBus.emit('staff.clock_in', {
    restaurantId: user.restaurant_id,
    type: 'staff.clock_in',
    actor: { actorType: 'user', actorId: user.id },
    payload: {
      staffId: user.id,
      staffName: user.name,
      timeEntryId: entryId,
      position
    },
    occurredAt: clockInTime
  });

  logger.info(`User ${user.name} clocked in at ${clockInTime}`);

  res.json({
    success: true,
    data: {
      entryId,
      userId: user.id,
      userName: user.name,
      clockInTime,
      position
    }
  });
}));

/**
 * POST /api/staff/clock/clock-out
 * Clock out a staff member (public - authenticated by PIN)
 */
router.post('/clock-out', asyncHandler(async (req: Request, res: Response) => {
  const { pin, notes } = req.body;

  if (!pin || pin.length !== 4) {
    return res.status(400).json({
      success: false,
      error: { message: 'PIN is required and must be 4 digits' }
    });
  }

  const db = DatabaseService.getInstance().getDatabase();

  const user = await db.get(`
    SELECT * FROM users WHERE pin = ? AND is_active = TRUE
  `, [pin]);

  if (!user) {
    return res.status(404).json({
      success: false,
      error: { message: 'User not found or inactive' }
    });
  }

  // Find active time entry
  const timeEntry = await db.get(`
    SELECT * FROM time_entries
    WHERE user_id = ? AND clock_out_time IS NULL
    ORDER BY clock_in_time DESC
    LIMIT 1
  `, [user.id]);

  if (!timeEntry) {
    return res.status(400).json({
      success: false,
      error: { message: 'User is not currently clocked in' }
    });
  }

  const clockOutTime = new Date().toISOString();
  const clockInTime = new Date(timeEntry.clock_in_time);
  const clockOut = new Date(clockOutTime);

  // Calculate total hours (excluding breaks)
  const totalMinutes = Math.floor((clockOut.getTime() - clockInTime.getTime()) / (1000 * 60));
  const totalHours = Math.max(0, (totalMinutes - timeEntry.break_minutes) / 60);

  // Update time entry
  await db.run(`
    UPDATE time_entries
    SET clock_out_time = ?, total_hours = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `, [clockOutTime, totalHours.toFixed(2), notes || null, timeEntry.id]);

  await DatabaseService.getInstance().logAudit(
    user.restaurant_id,
    user.id,
    'clock_out',
    'time_entry',
    timeEntry.id,
    {
      clockOutTime,
      totalHours: totalHours.toFixed(2),
      breakMinutes: timeEntry.break_minutes,
      notes
    }
  );

  await eventBus.emit('staff.clock_out', {
    restaurantId: user.restaurant_id,
    type: 'staff.clock_out',
    actor: { actorType: 'user', actorId: user.id },
    payload: {
      staffId: user.id,
      staffName: user.name,
      timeEntryId: timeEntry.id,
      totalHours: Number(totalHours.toFixed(2)),
      breakMinutes: timeEntry.break_minutes
    },
    occurredAt: clockOutTime
  });

  logger.info(`User ${user.name} clocked out at ${clockOutTime}, worked ${totalHours.toFixed(2)} hours`);

  res.json({
    success: true,
    data: {
      entryId: timeEntry.id,
      userId: user.id,
      userName: user.name,
      clockInTime: timeEntry.clock_in_time,
      clockOutTime,
      totalHours: parseFloat(totalHours.toFixed(2)),
      breakMinutes: timeEntry.break_minutes
    }
  });
}));

/**
 * POST /api/staff/clock/start-break
 * Start a break (public - authenticated by PIN)
 */
router.post('/start-break', asyncHandler(async (req: Request, res: Response) => {
  const { pin } = req.body;

  if (!pin || pin.length !== 4) {
    return res.status(400).json({
      success: false,
      error: { message: 'PIN is required and must be 4 digits' }
    });
  }

  const db = DatabaseService.getInstance().getDatabase();

  const user = await db.get(`
    SELECT * FROM users WHERE pin = ? AND is_active = TRUE
  `, [pin]);

  if (!user) {
    return res.status(404).json({
      success: false,
      error: { message: 'User not found or inactive' }
    });
  }

  // Find active time entry
  const timeEntry = await db.get(`
    SELECT * FROM time_entries
    WHERE user_id = ? AND clock_out_time IS NULL
    ORDER BY clock_in_time DESC
    LIMIT 1
  `, [user.id]);

  if (!timeEntry) {
    return res.status(400).json({
      success: false,
      error: { message: 'User is not currently clocked in' }
    });
  }

  // Check if already on break
  const activeBreak = await db.get(`
    SELECT * FROM time_entry_breaks
    WHERE time_entry_id = ? AND break_end IS NULL
    ORDER BY break_start DESC
    LIMIT 1
  `, [timeEntry.id]);

  if (activeBreak) {
    return res.status(400).json({
      success: false,
      error: {
        message: 'User is already on break',
        breakStartTime: activeBreak.break_start
      }
    });
  }

  // Create break entry
  const breakId = uuidv4();
  const breakStart = new Date().toISOString();

  await db.run(`
    INSERT INTO time_entry_breaks (id, time_entry_id, break_start)
    VALUES (?, ?, ?)
  `, [breakId, timeEntry.id, breakStart]);

  await DatabaseService.getInstance().logAudit(
    timeEntry.restaurant_id,
    user.id,
    'start_break',
    'time_entry_break',
    breakId,
    { timeEntryId: timeEntry.id, breakStart }
  );

  await eventBus.emit('staff.break_start', {
    restaurantId: timeEntry.restaurant_id,
    type: 'staff.break_start',
    actor: { actorType: 'user', actorId: user.id },
    payload: {
      staffId: user.id,
      staffName: user.name,
      timeEntryId: timeEntry.id,
      breakId
    },
    occurredAt: breakStart
  });

  res.json({
    success: true,
    data: {
      breakId,
      timeEntryId: timeEntry.id,
      breakStart
    }
  });
}));

/**
 * POST /api/staff/clock/end-break
 * End a break (public - authenticated by PIN)
 */
router.post('/end-break', asyncHandler(async (req: Request, res: Response) => {
  const { pin } = req.body;

  if (!pin || pin.length !== 4) {
    return res.status(400).json({
      success: false,
      error: { message: 'PIN is required and must be 4 digits' }
    });
  }

  const db = DatabaseService.getInstance().getDatabase();

  const user = await db.get(`
    SELECT * FROM users WHERE pin = ? AND is_active = TRUE
  `, [pin]);

  if (!user) {
    return res.status(404).json({
      success: false,
      error: { message: 'User not found or inactive' }
    });
  }

  // Find active time entry
  const timeEntry = await db.get(`
    SELECT * FROM time_entries
    WHERE user_id = ? AND clock_out_time IS NULL
    ORDER BY clock_in_time DESC
    LIMIT 1
  `, [user.id]);

  if (!timeEntry) {
    return res.status(400).json({
      success: false,
      error: { message: 'User is not currently clocked in' }
    });
  }

  // Find active break
  const activeBreak = await db.get(`
    SELECT * FROM time_entry_breaks
    WHERE time_entry_id = ? AND break_end IS NULL
    ORDER BY break_start DESC
    LIMIT 1
  `, [timeEntry.id]);

  if (!activeBreak) {
    return res.status(400).json({
      success: false,
      error: { message: 'User is not currently on break' }
    });
  }

  const breakEnd = new Date().toISOString();
  const breakStart = new Date(activeBreak.break_start);
  const breakEndTime = new Date(breakEnd);
  const durationMinutes = Math.floor((breakEndTime.getTime() - breakStart.getTime()) / (1000 * 60));

  // Update break entry
  await db.run(`
    UPDATE time_entry_breaks
    SET break_end = ?, duration_minutes = ?
    WHERE id = ?
  `, [breakEnd, durationMinutes, activeBreak.id]);

  // Update time entry with total break minutes
  const totalBreaks = await db.get(`
    SELECT COALESCE(SUM(duration_minutes), 0) as total_break_minutes
    FROM time_entry_breaks
    WHERE time_entry_id = ? AND duration_minutes IS NOT NULL
  `, [timeEntry.id]);

  await db.run(`
    UPDATE time_entries
    SET break_minutes = ?
    WHERE id = ?
  `, [totalBreaks.total_break_minutes, timeEntry.id]);

  await DatabaseService.getInstance().logAudit(
    timeEntry.restaurant_id,
    user.id,
    'end_break',
    'time_entry_break',
    activeBreak.id,
    {
      timeEntryId: timeEntry.id,
      breakEnd,
      durationMinutes,
      totalBreakMinutes: totalBreaks.total_break_minutes
    }
  );

  await eventBus.emit('staff.break_end', {
    restaurantId: timeEntry.restaurant_id,
    type: 'staff.break_end',
    actor: { actorType: 'user', actorId: user.id },
    payload: {
      staffId: user.id,
      staffName: user.name,
      timeEntryId: timeEntry.id,
      breakId: activeBreak.id,
      durationMinutes
    },
    occurredAt: breakEnd
  });

  res.json({
    success: true,
    data: {
      breakId: activeBreak.id,
      timeEntryId: timeEntry.id,
      breakStart: activeBreak.break_start,
      breakEnd,
      durationMinutes,
      totalBreakMinutes: totalBreaks.total_break_minutes
    }
  });
}));

/**
 * POST /api/staff/clock/end-pending-break
 * End a break that was started but never properly ended
 * This handles the case where user starts break, logs out, logs back in
 */
router.post('/end-pending-break', asyncHandler(async (req: Request, res: Response) => {
  const { pin } = req.body;

  if (!pin || pin.length !== 4) {
    return res.status(400).json({
      success: false,
      error: { message: 'PIN is required and must be 4 digits' }
    });
  }

  const db = DatabaseService.getInstance().getDatabase();

  const user = await db.get(`
    SELECT * FROM users WHERE pin = ? AND is_active = TRUE
  `, [pin]);

  if (!user) {
    return res.status(404).json({
      success: false,
      error: { message: 'User not found or inactive' }
    });
  }

  // Find any pending break (break without end time) for this user
  const pendingBreak = await db.get(`
    SELECT tb.*, te.restaurant_id, te.clock_in_time
    FROM time_entry_breaks tb
    JOIN time_entries te ON tb.time_entry_id = te.id
    WHERE te.user_id = ? AND tb.break_end IS NULL
    ORDER BY tb.break_start DESC
    LIMIT 1
  `, [user.id]);

  if (!pendingBreak) {
    return res.status(400).json({
      success: false,
      error: { message: 'No active break found' }
    });
  }

  // End the break
  const breakEnd = new Date().toISOString();
  const breakStart = new Date(pendingBreak.break_start);
  const breakEndTime = new Date(breakEnd);
  const durationMinutes = Math.floor((breakEndTime.getTime() - breakStart.getTime()) / (1000 * 60));

  await db.run(`
    UPDATE time_entry_breaks
    SET break_end = ?, duration_minutes = ?
    WHERE id = ?
  `, [breakEnd, durationMinutes, pendingBreak.id]);

  // Update time entry with total break minutes
  const totalBreaks = await db.get(`
    SELECT COALESCE(SUM(duration_minutes), 0) as total_break_minutes
    FROM time_entry_breaks
    WHERE time_entry_id = ? AND duration_minutes IS NOT NULL
  `, [pendingBreak.time_entry_id]);

  await db.run(`
    UPDATE time_entries
    SET break_minutes = ?
    WHERE id = ?
  `, [totalBreaks.total_break_minutes, pendingBreak.time_entry_id]);

  await DatabaseService.getInstance().logAudit(
    pendingBreak.restaurant_id,
    user.id,
    'end_break',
    'time_entry_break',
    pendingBreak.id,
    {
      timeEntryId: pendingBreak.time_entry_id,
      breakEnd,
      durationMinutes,
      totalBreakMinutes: totalBreaks.total_break_minutes
    }
  );

  res.json({
    success: true,
    data: {
      breakId: pendingBreak.id,
      timeEntryId: pendingBreak.time_entry_id,
      breakStart: pendingBreak.break_start,
      breakEnd,
      durationMinutes,
      totalBreakMinutes: totalBreaks.total_break_minutes
    }
  });
}));

/**
 * GET /api/staff/clock/my-stats
 * Get current user's time tracking stats (public - authenticated by PIN)
 */
router.get('/my-stats', asyncHandler(async (req: Request, res: Response) => {
  const { pin } = req.query;

  if (!pin || (typeof pin === 'string' && pin.length !== 4)) {
    return res.status(400).json({
      success: false,
      error: { message: 'PIN is required and must be 4 digits' }
    });
  }

  const db = DatabaseService.getInstance().getDatabase();

  const user = await db.get(`
    SELECT id, name FROM users WHERE pin = ? AND is_active = TRUE
  `, [pin]);

  if (!user) {
    return res.status(404).json({
      success: false,
      error: { message: 'User not found' }
    });
  }

  // Get weekly hours (current week starting Monday)
  const startOfWeek = new Date();
  startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
  startOfWeek.setHours(0, 0, 0, 0);

  const [weeklyHours, recentEntries] = await Promise.all([
    db.get(`
      SELECT
        COALESCE(SUM(total_hours), 0) as total_hours,
        COUNT(*) as total_shifts,
        COALESCE(SUM(break_minutes), 0) as total_break_minutes
      FROM time_entries
      WHERE user_id = ? AND clock_out_time IS NOT NULL AND clock_in_time >= ?
    `, [user.id, startOfWeek.toISOString()]),

    db.all(`
      SELECT
        id,
        clock_in_time,
        clock_out_time,
        total_hours,
        break_minutes,
        position
      FROM time_entries
      WHERE user_id = ?
      ORDER BY clock_in_time DESC
      LIMIT 10
    `, [user.id])
  ]);

  res.json({
    success: true,
    data: {
      userId: user.id,
      userName: user.name,
      weeklyStats: {
        totalHours: Number(weeklyHours.total_hours || 0),
        totalShifts: Number(weeklyHours.total_shifts || 0),
        totalBreakMinutes: Number(weeklyHours.total_break_minutes || 0)
      },
      recentEntries: recentEntries.map(e => ({
        ...e,
        total_hours: Number(e.total_hours || 0)
      }))
    }
  });
}));

export default router;
