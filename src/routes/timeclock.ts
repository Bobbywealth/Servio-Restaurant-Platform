import { Router, Request, Response } from 'express';
import { DatabaseService } from '../services/DatabaseService';
import { asyncHandler } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';
import { eventBus } from '../events/bus';

const router = Router();
const num = (v: any) => (typeof v === 'number' ? v : Number(v ?? 0));


/**
 * POST /api/timeclock/clock-in
 * Clock in a user
 */
router.post('/clock-in', asyncHandler(async (req: Request, res: Response) => {
  const { userId, pin, position } = req.body;

  if (!userId && !pin) {
    return res.status(400).json({
      success: false,
      error: { message: 'Either userId or PIN is required' }
    });
  }

  const db = DatabaseService.getInstance().getDatabase();

  // If PIN provided, look up user
  let user;
  if (pin) {
    user = await db.get('SELECT * FROM users WHERE pin = ? AND is_active = TRUE', [pin]);
  } else {
    user = await db.get('SELECT * FROM users WHERE id = ? AND is_active = TRUE', [userId]);
  }

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

  // Log the action
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
 * POST /api/timeclock/clock-out
 * Clock out a user
 */
router.post('/clock-out', asyncHandler(async (req: Request, res: Response) => {
  const { userId, pin, notes } = req.body;

  if (!userId && !pin) {
    return res.status(400).json({
      success: false,
      error: { message: 'Either userId or PIN is required' }
    });
  }

  const db = DatabaseService.getInstance().getDatabase();

  // If PIN provided, look up user
  let user;
  if (pin) {
    user = await db.get('SELECT * FROM users WHERE pin = ? AND is_active = TRUE', [pin]);
  } else {
    user = await db.get('SELECT * FROM users WHERE id = ? AND is_active = TRUE', [userId]);
  }

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

  // Log the action
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
 * POST /api/timeclock/start-break
 * Start a break for a user
 */
router.post('/start-break', asyncHandler(async (req: Request, res: Response) => {
  const { userId, pin } = req.body;

  if (!userId && !pin) {
    return res.status(400).json({
      success: false,
      error: { message: 'Either userId or PIN is required' }
    });
  }

  const db = DatabaseService.getInstance().getDatabase();

  // If PIN provided, look up user
  let user;
  if (pin) {
    user = await db.get('SELECT * FROM users WHERE pin = ? AND is_active = TRUE', [pin]);
  } else {
    user = await db.get('SELECT * FROM users WHERE id = ? AND is_active = TRUE', [userId]);
  }

  if (!user) {
    return res.status(404).json({
      success: false,
      error: { message: 'User not found or inactive' }
    });
  }

  const actualUserId = user.id;

  // Find active time entry
  const timeEntry = await db.get(`
    SELECT * FROM time_entries
    WHERE user_id = ? AND clock_out_time IS NULL
    ORDER BY clock_in_time DESC
    LIMIT 1
  `, [actualUserId]);

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

  // Log the action
  await DatabaseService.getInstance().logAudit(
    timeEntry.restaurant_id,
    actualUserId,
    'start_break',
    'time_entry_break',
    breakId,
    { timeEntryId: timeEntry.id, breakStart }
  );

  const staff = await db.get('SELECT name FROM users WHERE id = ?', [actualUserId]);
  await eventBus.emit('staff.break_start', {
    restaurantId: timeEntry.restaurant_id,
    type: 'staff.break_start',
    actor: { actorType: 'user', actorId: actualUserId },
    payload: {
      staffId: actualUserId,
      staffName: staff?.name,
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
 * POST /api/timeclock/end-break
 * End a break for a user
 */
router.post('/end-break', asyncHandler(async (req: Request, res: Response) => {
  const { userId, pin } = req.body;

  if (!userId && !pin) {
    return res.status(400).json({
      success: false,
      error: { message: 'Either userId or PIN is required' }
    });
  }

  const db = DatabaseService.getInstance().getDatabase();

  // If PIN provided, look up user
  let user;
  if (pin) {
    user = await db.get('SELECT * FROM users WHERE pin = ? AND is_active = TRUE', [pin]);
  } else {
    user = await db.get('SELECT * FROM users WHERE id = ? AND is_active = TRUE', [userId]);
  }

  if (!user) {
    return res.status(404).json({
      success: false,
      error: { message: 'User not found or inactive' }
    });
  }

  const actualUserId = user.id;

  // Find active time entry
  const timeEntry = await db.get(`
    SELECT * FROM time_entries
    WHERE user_id = ? AND clock_out_time IS NULL
    ORDER BY clock_in_time DESC
    LIMIT 1
  `, [actualUserId]);

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

  // Log the action
  await DatabaseService.getInstance().logAudit(
    timeEntry.restaurant_id,
    actualUserId,
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

  const staff = await db.get('SELECT name FROM users WHERE id = ?', [actualUserId]);
  await eventBus.emit('staff.break_end', {
    restaurantId: timeEntry.restaurant_id,
    type: 'staff.break_end',
    actor: { actorType: 'user', actorId: actualUserId },
    payload: {
      staffId: actualUserId,
      staffName: staff?.name,
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
 * GET /api/timeclock/current-staff
 * Get currently clocked in staff
 */
router.get('/current-staff', asyncHandler(async (req: Request, res: Response) => {
  const db = DatabaseService.getInstance().getDatabase();

  const currentStaff = await db.all(`
    SELECT
      u.id as user_id,
      u.name,
      u.role,
      te.id as time_entry_id,
      te.clock_in_time,
      te.position,
      te.break_minutes,
      CASE
        WHEN teb.id IS NOT NULL AND teb.break_end IS NULL THEN 1
        ELSE 0
      END as is_on_break,
      teb.break_start as current_break_start,
      ROUND((EXTRACT(EPOCH FROM (NOW() - te.clock_in_time)) / 3600)::numeric, 2) as hours_worked
    FROM time_entries te
    JOIN users u ON te.user_id = u.id
    LEFT JOIN time_entry_breaks teb ON te.id = teb.time_entry_id AND teb.break_end IS NULL
    WHERE te.clock_out_time IS NULL
    AND u.is_active = TRUE
    ORDER BY te.clock_in_time ASC
  `);

  res.json({
    success: true,
    data: {
      currentStaff,
      totalStaff: currentStaff.length,
      staffOnBreak: currentStaff.filter(s => s.is_on_break).length
    }
  });
}));

/**
 * GET /api/timeclock/entries
 * Get time entries with filtering
 */
router.get('/entries', asyncHandler(async (req: Request, res: Response) => {
  const {
    userId,
    startDate,
    endDate,
    status = 'all', // 'active', 'completed', 'all'
    limit = 50,
    offset = 0
  } = req.query;

  const db = DatabaseService.getInstance().getDatabase();

  let query = `
    SELECT
      te.*,
      u.name as user_name,
      u.role as user_role,
      ROUND(COALESCE(te.total_hours, 0)::numeric, 2) as total_hours
    FROM time_entries te
    JOIN users u ON te.user_id = u.id
  `;

  const params: any[] = [];
  const conditions: string[] = [];

  if (userId) {
    conditions.push('te.user_id = ?');
    params.push(userId);
  }

  if (startDate) {
    conditions.push('te.clock_in_time::date >= ?');
    params.push(startDate);
  }

  if (endDate) {
    conditions.push('te.clock_in_time::date <= ?');
    params.push(endDate);
  }

  if (status === 'active') {
    conditions.push('te.clock_out_time IS NULL');
  } else if (status === 'completed') {
    conditions.push('te.clock_out_time IS NOT NULL');
  }

  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }

  query += ' ORDER BY te.clock_in_time DESC LIMIT ? OFFSET ?';
  params.push(Number(limit), Number(offset));

  const entries = await db.all(query, params);

  // Get total count for pagination
  let countQuery = `
    SELECT COUNT(*) as total
    FROM time_entries te
    JOIN users u ON te.user_id = u.id
  `;

  if (conditions.length > 0) {
    countQuery += ' WHERE ' + conditions.join(' AND ');
  }

  const countResult = await db.get(countQuery, params.slice(0, -2));

  res.json({
    success: true,
    data: {
      entries,
      pagination: {
        total: num(countResult.total),
        limit: Number(limit),
        offset: Number(offset),
        hasMore: num(countResult.total) > Number(offset) + entries.length
      }
    }
  });
}));

/**
 * PUT /api/timeclock/entries/:id
 * Edit a time entry (manager only)
 */
router.put('/entries/:id', asyncHandler(async (req: Request, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const {
    clockInTime,
    clockOutTime,
    breakMinutes,
    position,
    notes,
    editedBy
  } = req.body;

  const db = DatabaseService.getInstance().getDatabase();

  // Get existing entry
  const existingEntry = await db.get('SELECT * FROM time_entries WHERE id = ?', [id]);

  if (!existingEntry) {
    return res.status(404).json({
      success: false,
      error: { message: 'Time entry not found' }
    });
  }

  // Calculate new total hours if times are provided
  let totalHours = existingEntry.total_hours;
  if (clockInTime && clockOutTime) {
    const clockIn = new Date(clockInTime);
    const clockOut = new Date(clockOutTime);
    const totalMinutes = Math.floor((clockOut.getTime() - clockIn.getTime()) / (1000 * 60));
    totalHours = Math.max(0, (totalMinutes - (breakMinutes || existingEntry.break_minutes)) / 60);
  }

  // Update time entry
  await db.run(`
    UPDATE time_entries
    SET
      clock_in_time = COALESCE(?, clock_in_time),
      clock_out_time = COALESCE(?, clock_out_time),
      break_minutes = COALESCE(?, break_minutes),
      total_hours = ?,
      position = COALESCE(?, position),
      notes = COALESCE(?, notes),
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `, [
    clockInTime || null,
    clockOutTime || null,
    breakMinutes !== undefined ? breakMinutes : null,
    totalHours,
    position || null,
    notes || null,
    id
  ]);

  // Log the edit
  await DatabaseService.getInstance().logAudit(
    existingEntry.restaurant_id,
    editedBy || 'system',
    'edit_time_entry',
    'time_entry',
    id,
    {
      originalEntry: existingEntry,
      changes: {
        clockInTime,
        clockOutTime,
        breakMinutes,
        totalHours,
        position,
        notes
      }
    }
  );

  // Get updated entry
  const updatedEntry = await db.get(`
    SELECT
      te.*,
      u.name as user_name,
      u.role as user_role
    FROM time_entries te
    JOIN users u ON te.user_id = u.id
    WHERE te.id = ?
  `, [id]);

  res.json({
    success: true,
    data: updatedEntry
  });
}));

/**
 * GET /api/timeclock/stats
 * Get time tracking statistics
 */
router.get('/stats', asyncHandler(async (req: Request, res: Response) => {
  const {
    startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate = new Date().toISOString().split('T')[0],
    userId
  } = req.query;

  const db = DatabaseService.getInstance().getDatabase();

  let baseQuery = `
    FROM time_entries te
    JOIN users u ON te.user_id = u.id
    WHERE te.clock_in_time::date >= ?
    AND te.clock_in_time::date <= ?
    AND te.clock_out_time IS NOT NULL
  `;

  const params = [startDate, endDate];

  if (userId) {
    baseQuery += ' AND te.user_id = ?';
    params.push(userId as string);
  }

  const [
    totalStats,
    dailyStats,
    userStats
  ] = await Promise.all([
    // Total statistics
    db.get(`
      SELECT
        COUNT(*) as total_entries,
        ROUND(COALESCE(SUM(te.total_hours), 0)::numeric, 2) as total_hours,
        ROUND(COALESCE(AVG(te.total_hours), 0)::numeric, 2) as avg_hours_per_shift,
        SUM(te.break_minutes) as total_break_minutes
      ${baseQuery}
    `, params),

    // Daily breakdown
    db.all(`
      SELECT
        te.clock_in_time::date as date,
        COUNT(*) as entries_count,
        ROUND(COALESCE(SUM(te.total_hours), 0)::numeric, 2) as total_hours,
        COUNT(DISTINCT te.user_id) as unique_staff
      ${baseQuery}
      GROUP BY te.clock_in_time::date
      ORDER BY te.clock_in_time::date
    `, params),

    // Per-user statistics (if not filtering by specific user)
    userId ? null : db.all(`
      SELECT
        u.id as user_id,
        u.name,
        u.role,
        COUNT(*) as total_entries,
        ROUND(COALESCE(SUM(te.total_hours), 0)::numeric, 2) as total_hours,
        ROUND(COALESCE(AVG(te.total_hours), 0)::numeric, 2) as avg_hours_per_shift
      ${baseQuery}
      GROUP BY u.id, u.name, u.role
      ORDER BY total_hours DESC
    `, params)
  ]);

  res.json({
    success: true,
    data: {
      period: { startDate, endDate },
      totalStats,
      dailyStats,
      userStats: userStats || []
    }
  });
}));

/**
 * POST /api/timeclock/pin-login
 * Authenticate staff by PIN for PWA clock-in
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
        WHEN teb.id IS NOT NULL AND teb.break_end IS NULL THEN 1
        ELSE 0
      END as is_on_break,
      teb.break_start as current_break_start
    FROM time_entries te
    LEFT JOIN time_entry_breaks teb ON te.id = teb.time_entry_id AND teb.break_end IS NULL
    WHERE te.user_id = ? AND te.clock_out_time IS NULL
    ORDER BY te.clock_in_time DESC
    LIMIT 1
  `, [user.id]);

  // Get weekly hours
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
        restaurantName: user.restaurant_name
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
 * GET /api/timeclock/my-stats
 * Get current user's time tracking stats for PWA
 */
router.get('/my-stats', asyncHandler(async (req: Request, res: Response) => {
  const { userId, pin } = req.query;

  if (!userId && !pin) {
    return res.status(400).json({
      success: false,
      error: { message: 'Either userId or PIN is required' }
    });
  }

  const db = DatabaseService.getInstance().getDatabase();

  // If PIN provided, look up user
  let user;
  if (pin) {
    user = await db.get('SELECT id, name FROM users WHERE pin = ? AND is_active = TRUE', [pin]);
  } else {
    user = await db.get('SELECT id, name FROM users WHERE id = ? AND is_active = TRUE', [userId]);
  }

  if (!user) {
    return res.status(404).json({
      success: false,
      error: { message: 'User not found' }
    });
  }

  const actualUserId = user.id;

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
    `, [actualUserId, startOfWeek.toISOString()]),

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
    `, [actualUserId])
  ]);

  res.json({
    success: true,
    data: {
      userId: actualUserId,
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

/**
 * GET /api/timeclock/staff-hours
 * Get hours worked today for all staff (for dashboard display)
 */
router.get('/staff-hours', asyncHandler(async (req: Request, res: Response) => {
  const db = DatabaseService.getInstance().getDatabase();

  // Get start of today (midnight)
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  // Get hours worked today for all staff
  const todayHours = await db.all(`
    SELECT
      u.id as user_id,
      u.name,
      COALESCE(SUM(te.total_hours), 0) as today_hours,
      COUNT(*) as shifts_today
    FROM users u
    LEFT JOIN time_entries te ON u.id = te.user_id
      AND te.clock_in_time >= ?
      AND te.clock_out_time IS NOT NULL
    WHERE u.is_active = TRUE
    GROUP BY u.id, u.name
    ORDER BY today_hours DESC, u.name ASC
  `, [startOfToday.toISOString()]);

  res.json({
    success: true,
    data: {
      staffHours: todayHours.map(s => ({
        userId: s.user_id,
        name: s.name,
        todayHours: Number(s.today_hours || 0),
        shiftsToday: Number(s.shifts_today || 0)
      })),
      date: startOfToday.toISOString().split('T')[0]
    }
  });
}));

/**
 * GET /api/timeclock/user-daily-hours
 * Get daily hours breakdown for all staff for the current week
 */
router.get('/user-daily-hours', asyncHandler(async (req: Request, res: Response) => {
  const db = DatabaseService.getInstance().getDatabase();

  // Get start of current week (Monday)
  const now = new Date();
  const dayOfWeek = now.getDay();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1));
  startOfWeek.setHours(0, 0, 0, 0);

  // Get daily hours for each user this week
  const dailyHours = await db.all(`
    SELECT
      u.id as user_id,
      u.name,
      te.clock_in_time::date as work_date,
      COALESCE(SUM(te.total_hours), 0) as hours
    FROM users u
    LEFT JOIN time_entries te ON u.id = te.user_id
      AND te.clock_in_time >= ?
      AND te.clock_out_time IS NOT NULL
    WHERE u.is_active = TRUE
    GROUP BY u.id, u.name, te.clock_in_time::date
    ORDER BY u.name, te.clock_in_time::date
  `, [startOfWeek.toISOString()]);

  // Also get currently clocked-in hours for today
  const currentHours = await db.all(`
    SELECT
      u.id as user_id,
      ROUND((EXTRACT(EPOCH FROM (NOW() - te.clock_in_time)) / 3600)::numeric, 2) as current_hours
    FROM users u
    JOIN time_entries te ON u.id = te.user_id
    WHERE u.is_active = TRUE
      AND te.clock_out_time IS NULL
      AND te.clock_in_time::date = CURRENT_DATE
  `);

  // Build a map of user_id -> { date -> hours }
  const userDailyHours: Record<string, Record<string, number>> = {};
  const userCurrentHours: Record<string, number> = {};

  for (const row of dailyHours) {
    if (!userDailyHours[row.user_id]) {
      userDailyHours[row.user_id] = {};
    }
    if (row.work_date) {
      userDailyHours[row.user_id][row.work_date] = Number(row.hours || 0);
    }
  }

  for (const row of currentHours) {
    userCurrentHours[row.user_id] = Number(row.current_hours || 0);
  }

  res.json({
    success: true,
    data: {
      userDailyHours,
      userCurrentHours,
      weekStartDate: startOfWeek.toISOString().split('T')[0]
    }
  });
}));

export default router;