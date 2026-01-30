import { Router, Request, Response } from 'express';
import { DatabaseService } from '../services/DatabaseService';
import { asyncHandler } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

const router = Router();

/**
 * GET /api/staff/analytics
 * Get comprehensive staff analytics
 */
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const { startDate, endDate, userId } = req.query;
  const restaurantId = (req as any).restaurantId;

  const db = DatabaseService.getInstance().getDatabase();

  // Default to current week if no date range specified
  const now = new Date();
  const defaultStartOfWeek = new Date(now);
  defaultStartOfWeek.setDate(now.getDate() - now.getDay() + (now.getDay() === 0 ? -6 : 1));
  defaultStartOfWeek.setHours(0, 0, 0, 0);

  const defaultEndOfWeek = new Date(defaultStartOfWeek);
  defaultEndOfWeek.setDate(defaultStartOfWeek.getDate() + 6);
  defaultEndOfWeek.setHours(23, 59, 59, 999);

  const start = startDate ? new Date(startDate as string) : defaultStartOfWeek;
  const end = endDate ? new Date(endDate as string) : defaultEndOfWeek;

  // Get basic time entry stats
  const timeStats = await db.get(`
    SELECT
      COUNT(*) as total_shifts,
      COUNT(DISTINCT user_id) as unique_staff,
      COALESCE(SUM(total_hours), 0) as total_hours,
      COALESCE(SUM(break_minutes), 0) as total_break_minutes,
      AVG(total_hours) as avg_hours_per_shift
    FROM time_entries te
    JOIN users u ON te.user_id = u.id
    WHERE te.restaurant_id = ?
      AND te.clock_in_time >= ?
      AND te.clock_in_time <= ?
      ${userId ? 'AND te.user_id = ?' : ''}
  `, userId ? [restaurantId, start.toISOString(), end.toISOString(), userId] : [restaurantId, start.toISOString(), end.toISOString()]);

  // Get hours by user
  const userHours = await db.all(`
    SELECT
      u.id as user_id,
      u.name as user_name,
      u.role as user_role,
      COUNT(te.id) as shift_count,
      COALESCE(SUM(te.total_hours), 0) as total_hours,
      COALESCE(SUM(te.break_minutes), 0) as total_break_minutes
    FROM time_entries te
    JOIN users u ON te.user_id = u.id
    WHERE te.restaurant_id = ?
      AND te.clock_in_time >= ?
      AND te.clock_in_time <= ?
      ${userId ? 'AND te.user_id = ?' : ''}
    GROUP BY u.id, u.name, u.role
    ORDER BY total_hours DESC
  `, userId ? [restaurantId, start.toISOString(), end.toISOString(), userId] : [restaurantId, start.toISOString(), end.toISOString()]);

  // Get daily breakdown
  const dailyBreakdown = await db.all(`
    SELECT
      DATE(clock_in_time) as date,
      COUNT(*) as shifts,
      COUNT(DISTINCT user_id) as unique_staff,
      COALESCE(SUM(total_hours), 0) as total_hours
    FROM time_entries
    WHERE restaurant_id = ?
      AND clock_in_time >= ?
      AND clock_in_time <= ?
      ${userId ? 'AND user_id = ?' : ''}
    GROUP BY DATE(clock_in_time)
    ORDER BY date ASC
  `, userId ? [restaurantId, start.toISOString(), end.toISOString(), userId] : [restaurantId, start.toISOString(), end.toISOString()]);

  // Get hourly staffing levels
  const hourlyStaffing = await db.all(`
    SELECT
      EXTRACT(HOUR FROM clock_in_time) as hour,
      COUNT(*) as shifts_at_hour
    FROM time_entries
    WHERE restaurant_id = ?
      AND clock_in_time >= ?
      AND clock_in_time <= ?
      ${userId ? 'AND user_id = ?' : ''}
    GROUP BY EXTRACT(HOUR FROM clock_in_time)
    ORDER BY hour ASC
  `, userId ? [restaurantId, start.toISOString(), end.toISOString(), userId] : [restaurantId, start.toISOString(), end.toISOString()]);

  // Get overtime alerts (shifts > 8 hours)
  const overtimeShifts = await db.all(`
    SELECT
      te.id,
      te.user_id,
      u.name as user_name,
      te.clock_in_time,
      te.clock_out_time,
      te.total_hours,
      te.break_minutes
    FROM time_entries te
    JOIN users u ON te.user_id = u.id
    WHERE te.restaurant_id = ?
      AND te.clock_in_time >= ?
      AND te.clock_in_time <= ?
      AND te.total_hours > 8
      ${userId ? 'AND te.user_id = ?' : ''}
    ORDER BY te.total_hours DESC
  `, userId ? [restaurantId, start.toISOString(), end.toISOString(), userId] : [restaurantId, start.toISOString(), end.toISOString()]);

  // Get late arrivals (clocked in after scheduled start - if we had schedules)
  // For now, we'll detect late arrivals based on a threshold (e.g., after 9 AM)
  const lateArrivals = await db.all(`
    SELECT
      te.id,
      te.user_id,
      u.name as user_name,
      te.clock_in_time,
      EXTRACT(EPOCH FROM (clock_in_time - DATE_TRUNC('day', clock_in_time))) / 60 as minutes_after_midnight
    FROM time_entries te
    JOIN users u ON te.user_id = u.id
    WHERE te.restaurant_id = ?
      AND te.clock_in_time >= ?
      AND te.clock_in_time <= ?
      AND EXTRACT(HOUR FROM clock_in_time) >= 9
      ${userId ? 'AND te.user_id = ?' : ''}
    ORDER BY te.clock_in_time DESC
    LIMIT 20
  `, userId ? [restaurantId, start.toISOString(), end.toISOString(), userId] : [restaurantId, start.toISOString(), end.toISOString()]);

  res.json({
    success: true,
    data: {
      summary: {
        totalShifts: Number(timeStats?.total_shifts || 0),
        uniqueStaff: Number(timeStats?.unique_staff || 0),
        totalHours: Number(timeStats?.total_hours || 0),
        totalBreakMinutes: Number(timeStats?.total_break_minutes || 0),
        avgHoursPerShift: Number(timeStats?.avg_hours_per_shift || 0),
        dateRange: {
          start: start.toISOString(),
          end: end.toISOString()
        }
      },
      userHours: userHours.map((u: any) => ({
        ...u,
        total_hours: Number(u.total_hours),
        total_break_minutes: Number(u.total_break_minutes),
        shift_count: Number(u.shift_count)
      })),
      dailyBreakdown: dailyBreakdown.map((d: any) => ({
        ...d,
        total_hours: Number(d.total_hours),
        shifts: Number(d.shifts),
        unique_staff: Number(d.unique_staff)
      })),
      hourlyStaffing: hourlyStaffing.map((h: any) => ({
        hour: Number(h.hour),
        shifts_at_hour: Number(h.shifts_at_hour)
      })),
      alerts: {
        overtimeCount: overtimeShifts.length,
        overtimeShifts: overtimeShifts.map((o: any) => ({
          ...o,
          total_hours: Number(o.total_hours),
          break_minutes: Number(o.break_minutes)
        })),
        lateArrivalsCount: lateArrivals.length,
        lateArrivals: lateArrivals.map((l: any) => ({
          ...l,
          minutes_after_midnight: Number(l.minutes_after_midnight)
        }))
      }
    }
  });
}));

/**
 * GET /api/staff/analytics/performance
 * Get staff performance metrics
 */
router.get('/performance', asyncHandler(async (req: Request, res: Response) => {
  const { startDate, endDate, userId } = req.query;
  const restaurantId = (req as any).restaurantId;

  const db = DatabaseService.getInstance().getDatabase();

  const now = new Date();
  const defaultStart = new Date(now);
  defaultStart.setDate(now.getDate() - 30);
  defaultStart.setHours(0, 0, 0, 0);

  const start = startDate ? new Date(startDate as string) : defaultStart;
  const end = endDate ? new Date(endDate as string) : now;

  // Performance metrics per staff member
  const performance = await db.all(`
    WITH staff_data AS (
      SELECT
        u.id as user_id,
        u.name as user_name,
        u.role as user_role,
        COUNT(te.id) as total_shifts,
        COALESCE(SUM(te.total_hours), 0) as total_hours,
        COALESCE(SUM(te.break_minutes), 0) as total_break_minutes,
        MIN(te.total_hours) as min_shift_hours,
        MAX(te.total_hours) as max_shift_hours
      FROM time_entries te
      JOIN users u ON te.user_id = u.id
      WHERE te.restaurant_id = ?
        AND te.clock_in_time >= ?
        AND te.clock_in_time <= ?
        ${userId ? 'AND te.user_id = ?' : ''}
      GROUP BY u.id, u.name, u.role
    )
    SELECT
      *,
      total_break_minutes / 60.0 as total_break_hours,
      total_hours / NULLIF(total_shifts, 0) as avg_shift_hours,
      total_break_minutes / NULLIF(total_shifts, 0) as avg_break_minutes
    FROM staff_data
    ORDER BY total_hours DESC
  `, userId ? [restaurantId, start.toISOString(), end.toISOString(), userId] : [restaurantId, start.toISOString(), end.toISOString()]);

  // Attendance rate (shifts completed vs scheduled - simplified)
  const attendanceData = await db.get(`
    SELECT
      COUNT(*) as completed_shifts,
      COUNT(DISTINCT user_id) as active_staff
    FROM time_entries
    WHERE restaurant_id = ?
      AND clock_in_time >= ?
      AND clock_in_time <= ?
      AND clock_out_time IS NOT NULL
      ${userId ? 'AND user_id = ?' : ''}
  `, userId ? [restaurantId, start.toISOString(), end.toISOString(), userId] : [restaurantId, start.toISOString(), end.toISOString()]);

  res.json({
    success: true,
    data: {
      performance: performance.map((p: any) => ({
        ...p,
        total_hours: Number(p.total_hours),
        total_break_minutes: Number(p.total_break_minutes),
        total_shifts: Number(p.total_shifts),
        min_shift_hours: Number(p.min_shift_hours),
        max_shift_hours: Number(p.max_shift_hours),
        avg_shift_hours: Number(p.avg_shift_hours),
        avg_break_minutes: Number(p.avg_break_minutes)
      })),
      attendance: {
        completedShifts: Number(attendanceData?.completed_shifts || 0),
        activeStaff: Number(attendanceData?.active_staff || 0),
        dateRange: {
          start: start.toISOString(),
          end: end.toISOString()
        }
      }
    }
  });
}));

/**
 * GET /api/staff/analytics/time-logs
 * Get detailed time logs with pagination
 */
router.get('/time-logs', asyncHandler(async (req: Request, res: Response) => {
  const {
    startDate,
    endDate,
    userId,
    limit = '50',
    offset = '0',
    status
  } = req.query;
  const restaurantId = (req as any).restaurantId;

  const db = DatabaseService.getInstance().getDatabase();

  const limitNum = Math.min(parseInt(limit as string), 500);
  const offsetNum = parseInt(offset as string);

  let query = `
    SELECT
      te.id,
      te.user_id,
      u.name as user_name,
      u.email as user_email,
      u.role as user_role,
      te.clock_in_time,
      te.clock_out_time,
      te.total_hours,
      te.break_minutes,
      te.position,
      te.notes,
      te.created_at,
      CASE
        WHEN te.clock_out_time IS NULL THEN 'active'
        ELSE 'completed'
      END as status
    FROM time_entries te
    JOIN users u ON te.user_id = u.id
    WHERE te.restaurant_id = ?
  `;
  const params: any[] = [restaurantId];

  if (startDate) {
    query += ' AND te.clock_in_time >= ?';
    params.push(startDate);
  }

  if (endDate) {
    query += ' AND te.clock_in_time <= ?';
    params.push(endDate);
  }

  if (userId) {
    query += ' AND te.user_id = ?';
    params.push(userId);
  }

  if (status) {
    if (status === 'active') {
      query += ' AND te.clock_out_time IS NULL';
    } else if (status === 'completed') {
      query += ' AND te.clock_out_time IS NOT NULL';
    }
  }

  query += ' ORDER BY te.clock_in_time DESC LIMIT ? OFFSET ?';
  params.push(limitNum, offsetNum);

  const logs = await db.all(query, params);

  // Get total count for pagination
  let countQuery = `
    SELECT COUNT(*) as total
    FROM time_entries te
    WHERE te.restaurant_id = ?
  `;
  const countParams: any[] = [restaurantId];

  if (startDate) {
    countQuery += ' AND te.clock_in_time >= ?';
    countParams.push(startDate);
  }

  if (endDate) {
    countQuery += ' AND te.clock_in_time <= ?';
    countParams.push(endDate);
  }

  if (userId) {
    countQuery += ' AND te.user_id = ?';
    countParams.push(userId);
  }

  if (status) {
    if (status === 'active') {
      countQuery += ' AND te.clock_out_time IS NULL';
    } else if (status === 'completed') {
      countQuery += ' AND te.clock_out_time IS NOT NULL';
    }
  }

  const countResult = await db.get(countQuery, countParams);

  res.json({
    success: true,
    data: {
      logs: logs.map((l: any) => ({
        ...l,
        total_hours: l.total_hours ? Number(l.total_hours) : null,
        break_minutes: Number(l.break_minutes)
      })),
      pagination: {
        total: Number(countResult?.total || 0),
        limit: limitNum,
        offset: offsetNum,
        hasMore: offsetNum + limitNum < Number(countResult?.total || 0)
      }
    }
  });
}));

/**
 * POST /api/staff/analytics/export
 * Export analytics data as CSV
 */
router.post('/export', asyncHandler(async (req: Request, res: Response) => {
  const { startDate, endDate, userId, format = 'csv' } = req.body;
  const restaurantId = (req as any).restaurantId;

  const db = DatabaseService.getInstance().getDatabase();

  const start = startDate ? new Date(startDate) : new Date();
  const end = endDate ? new Date(endDate) : new Date();

  const logs = await db.all(`
    SELECT
      te.id,
      te.user_id,
      u.name as user_name,
      u.email as user_email,
      u.role as user_role,
      te.clock_in_time,
      te.clock_out_time,
      te.total_hours,
      te.break_minutes,
      te.position,
      te.notes
    FROM time_entries te
    JOIN users u ON te.user_id = u.id
    WHERE te.restaurant_id = ?
      AND te.clock_in_time >= ?
      AND te.clock_in_time <= ?
      ${userId ? 'AND te.user_id = ?' : ''}
    ORDER BY te.clock_in_time DESC
  `, userId ? [restaurantId, start.toISOString(), end.toISOString(), userId] : [restaurantId, start.toISOString(), end.toISOString()]);

  if (format === 'csv') {
    const headers = ['ID', 'User Name', 'Email', 'Role', 'Clock In', 'Clock Out', 'Hours', 'Break Minutes', 'Position', 'Notes'];
    const rows = logs.map((log: any) => [
      log.id,
      log.user_name,
      log.user_email || '',
      log.user_role,
      log.clock_in_time,
      log.clock_out_time || '',
      log.total_hours || '',
      log.break_minutes,
      log.position || '',
      log.notes || ''
    ]);

    const csv = [headers, ...rows].map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="time-logs-${start.toISOString().split('T')[0]}.csv"`);
    res.send(csv);
  } else {
    res.status(400).json({
      success: false,
      error: { message: 'Unsupported format. Use "csv".' }
    });
  }
}));

export default router;
