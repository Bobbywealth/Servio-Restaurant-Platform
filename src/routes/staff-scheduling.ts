import { Router, Request, Response } from 'express';
import { DatabaseService } from '../services/DatabaseService';
import { asyncHandler } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';
import { eventBus } from '../events/bus';

const router = Router();

interface ScheduleData {
  user_id: string;
  shift_date: string;
  shift_start_time: string;
  shift_end_time: string;
  position?: string;
  notes?: string;
}

interface AvailabilityData {
  day_of_week: number;
  is_available?: boolean;
  preferred_start_time?: string;
  preferred_end_time?: string;
  max_hours?: number;
}

interface ShiftTemplateData {
  name: string;
  start_time: string;
  end_time: string;
  break_minutes?: number;
  position?: string;
  color?: string;
  is_active?: boolean;
}

/**
 * GET /api/staff/scheduling/schedules
 * Get all schedules with optional filters
 */
router.get('/schedules', asyncHandler(async (req: Request, res: Response) => {
  const { userId, startDate, endDate, published } = req.query;
  const restaurantId = (req as any).user?.restaurantId;

  const db = DatabaseService.getInstance().getDatabase();

  let query = `
    SELECT
      s.*,
      u.name as user_name,
      u.role as user_role,
      u.email as user_email
    FROM staff_schedules s
    JOIN users u ON s.user_id = u.id
    WHERE s.restaurant_id = ?
  `;
  const params: any[] = [restaurantId];

  if (userId) {
    query += ` AND s.user_id = ?`;
    params.push(userId);
  }

  if (startDate) {
    query += ` AND s.shift_date >= ?`;
    params.push(startDate);
  }

  if (endDate) {
    query += ` AND s.shift_date <= ?`;
    params.push(endDate);
  }

  if (published !== undefined) {
    query += ` AND s.is_published = ?`;
    params.push(published === 'true');
  }

  query += ` ORDER BY s.shift_date, s.shift_start_time, u.name`;

  const schedules = await db.all(query, params);

  res.json({
    success: true,
    data: { schedules }
  });
}));

/**
 * GET /api/staff/scheduling/schedules/:id
 * Get a single schedule
 */
router.get('/schedules/:id', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const restaurantId = (req as any).user?.restaurantId;

  const db = DatabaseService.getInstance().getDatabase();

  const schedule = await db.get(`
    SELECT
      s.*,
      u.name as user_name,
      u.email as user_email,
      u.role as user_role
    FROM staff_schedules s
    JOIN users u ON s.user_id = u.id
    WHERE s.id = ? AND s.restaurant_id = ?
  `, [id, restaurantId]);

  if (!schedule) {
    return res.status(404).json({
      success: false,
      error: { message: 'Schedule not found' }
    });
  }

  res.json({
    success: true,
    data: { schedule }
  });
}));

/**
 * POST /api/staff/scheduling/schedules
 * Create a new schedule
 */
router.post('/schedules', asyncHandler(async (req: Request, res: Response) => {
  const data: ScheduleData = req.body;
  const user = (req as any).user;
  const restaurantId = user?.restaurantId;
  const userId = user?.id;

  // Validate restaurant context is present
  if (!restaurantId || restaurantId === 'null' || restaurantId === 'undefined') {
    logger.error('Schedule creation failed: restaurantId is missing or invalid', {
      restaurantId,
      userId,
      userRestaurantId: user?.restaurantId
    });
    return res.status(401).json({
      success: false,
      error: { message: 'Restaurant context not found. Please log out and log in again.' }
    });
  }

  if (!data.user_id || !data.shift_date || !data.shift_start_time || !data.shift_end_time) {
    return res.status(400).json({
      success: false,
      error: { message: 'Missing required fields' })
  }

  const db = DatabaseService.getInstance().getDatabase();

  // Verify the user belongs to the restaurant
  const targetUser = await db.get(
    'SELECT id, restaurant_id FROM users WHERE id = ? AND is_active = TRUE',
    [data.user_id]
  );

  if (!targetUser) {
    return res.status(404).json({
      success: false,
      error: { message: 'Staff member not found' }
    });
  }

  // Verify the target user belongs to the same restaurant
  if (targetUser.restaurant_id !== restaurantId) {
    return res.status(403).json({
      success: false,
      error: { message: 'Staff member does not belong to your restaurant' }
    });
  }

  // Check for scheduling conflicts
  const conflict = await db.get(`
    SELECT * FROM staff_schedules
    WHERE user_id = ?
      AND shift_date = ?
      AND restaurant_id = ?
      AND (
        (shift_start_time < ? AND shift_end_time > ?) OR
        (shift_start_time >= ? AND shift_start_time < ?)
      )
  `, [
    data.user_id,
    data.shift_date,
    restaurantId,
    data.shift_start_time,
    data.shift_end_time,
    data.shift_start_time,
    data.shift_end_time
  ]);

  if (conflict) {
    return res.status(409).json({
      success: false,
      error: { message: 'Schedule conflict exists for this user' }
    });
  }

  const scheduleId = uuidv4();

  await db.run(`
    INSERT INTO staff_schedules (
      id, restaurant_id, user_id, shift_date, shift_start_time,
      shift_end_time, position, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    scheduleId,
    restaurantId,
    data.user_id,
    data.shift_date,
    data.shift_start_time,
    data.shift_end_time,
    data.position || null,
    data.notes || null
  ]);

  await DatabaseService.getInstance().logAudit(
    restaurantId,
    userId,
    'create_schedule',
    'staff_schedule',
    scheduleId,
    { userId: data.user_id, date: data.shift_date }
  );

  await eventBus.emit('staff.schedule_created', {
    restaurantId,
    type: 'staff.schedule_created',
    actor: { actorType: 'user', actorId: userId },
    payload: { scheduleId, userId: data.user_id },
    occurredAt: new Date().toISOString()
  });

  logger.info(`Schedule created: ${scheduleId} for user ${data.user_id}`);

  res.status(201).json({
    success: true,
    data: { id: scheduleId, ...data }
  });
}));

/**
 * PUT /api/staff/scheduling/schedules/:id
 * Update a schedule
 */
router.put('/schedules/:id', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const data: Partial<ScheduleData> = req.body;
  const restaurantId = (req as any).user?.restaurantId;
  const userId = (req as any).user?.id;

  const db = DatabaseService.getInstance().getDatabase();

  // Check if schedule exists
  const existing = await db.get(`
    SELECT * FROM staff_schedules WHERE id = ? AND restaurant_id = ?
  `, [id, restaurantId]);

  if (!existing) {
    return res.status(404).json({
      success: false,
      error: { message: 'Schedule not found' }
    });
  }

  // Check for conflicts if changing times
  if (data.shift_start_time || data.shift_end_time) {
    const startTime = data.shift_start_time || existing.shift_start_time;
    const endTime = data.shift_end_time || existing.shift_end_time;

    const conflict = await db.get(`
      SELECT * FROM staff_schedules
      WHERE id != ? AND user_id = ? AND shift_date = ? AND restaurant_id = ?
        AND (
          (shift_start_time < ? AND shift_end_time > ?) OR
          (shift_start_time >= ? AND shift_start_time < ?)
        )
    `, [
      id,
      existing.user_id,
      existing.shift_date,
      restaurantId,
      startTime,
      endTime,
      startTime,
      endTime
    ]);

    if (conflict) {
      return res.status(409).json({
        success: false,
        error: { message: 'Schedule conflict exists' }
      });
    }
  }

  // Build update query dynamically
  const updates: string[] = [];
  const params: any[] = [];

  if (data.shift_start_time !== undefined) {
    updates.push('shift_start_time = ?');
    params.push(data.shift_start_time);
  }
  if (data.shift_end_time !== undefined) {
    updates.push('shift_end_time = ?');
    params.push(data.shift_end_time);
  }
  if (data.position !== undefined) {
    updates.push('position = ?');
    params.push(data.position);
  }
  if (data.notes !== undefined) {
    updates.push('notes = ?');
    params.push(data.notes);
  }

  if (updates.length === 0) {
    return res.json({
      success: true,
      data: { message: 'No changes made' }
    });
  }

  updates.push('updated_at = CURRENT_TIMESTAMP');
  params.push(id);

  await db.run(`
    UPDATE staff_schedules SET ${updates.join(', ')} WHERE id = ?
  `, params);

  await DatabaseService.getInstance().logAudit(
    restaurantId,
    userId,
    'update_schedule',
    'staff_schedule',
    String(id),
    data
  );

  await eventBus.emit('staff.schedule_updated', {
    restaurantId,
    type: 'staff.schedule_updated',
    actor: { actorType: 'user', actorId: userId },
    payload: { scheduleId: id },
    occurredAt: new Date().toISOString()
  });

  res.json({
    success: true,
    data: { message: 'Schedule updated successfully' }
  });
}));

/**
 * DELETE /api/staff/scheduling/schedules/:id
 * Delete a schedule
 */
router.delete('/schedules/:id', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const restaurantId = (req as any).user?.restaurantId;
  const userId = (req as any).user?.id;

  const db = DatabaseService.getInstance().getDatabase();

  const result = await db.run(`
    DELETE FROM staff_schedules WHERE id = ? AND restaurant_id = ?
  `, [id, restaurantId]);

  if (result.changes === 0) {
    return res.status(404).json({
      success: false,
      error: { message: 'Schedule not found' }
    });
  }

  await DatabaseService.getInstance().logAudit(
    restaurantId,
    userId,
    'delete_schedule',
    'staff_schedule',
    String(id),
    {}
  );

  await eventBus.emit('staff.schedule_deleted', {
    restaurantId,
    type: 'staff.schedule_deleted',
    actor: { actorType: 'user', actorId: userId },
    payload: { scheduleId: id },
    occurredAt: new Date().toISOString()
  });

  res.json({
    success: true,
    data: { message: 'Schedule deleted successfully' }
  });
}));

/**
 * POST /api/staff/scheduling/schedules/bulk
 * Create multiple schedules at once
 */
router.post('/schedules/bulk', asyncHandler(async (req: Request, res: Response) => {
  const { schedules }: { schedules: ScheduleData[] } = req.body;
  const restaurantId = (req as any).user?.restaurantId;
  const userId = (req as any).user?.id;

  // Validate restaurant context is present
  if (!restaurantId || restaurantId === 'null' || restaurantId === 'undefined') {
    logger.error('Bulk schedule creation failed: restaurantId is missing or invalid', {
      restaurantId,
      userId
    });
    return res.status(401).json({
      success: false,
      error: { message: 'Restaurant context not found. Please log out and log in again.' }
    });
  }

  if (!Array.isArray(schedules) || schedules.length === 0) {
    return res.status(400).json({
      success: false,
      error: { message: 'schedules array is required' }
    });
  }

  const db = DatabaseService.getInstance().getDatabase();
  const created: string[] = [];
  const conflicts: string[] = [];

  for (const schedule of schedules) {
    // Skip schedules without user_id
    if (!schedule.user_id) {
      continue;
    }

    // Verify the user belongs to the restaurant
    const targetUser = await db.get(
      'SELECT id, restaurant_id FROM users WHERE id = ? AND is_active = TRUE',
      [schedule.user_id]
    );

    if (!targetUser || targetUser.restaurant_id !== restaurantId) {
      // Skip users not in this restaurant
      continue;
    }

    const conflict = await db.get(`
      SELECT * FROM staff_schedules
      WHERE user_id = ? AND shift_date = ? AND restaurant_id = ?
        AND (
          (shift_start_time < ? AND shift_end_time > ?) OR
          (shift_start_time >= ? AND shift_start_time < ?)
        )
    `, [
      schedule.user_id,
      schedule.shift_date,
      restaurantId,
      schedule.shift_start_time,
      schedule.shift_end_time,
      schedule.shift_start_time,
      schedule.shift_end_time
    ]);

    if (conflict) {
      conflicts.push(`${schedule.user_id}:${schedule.shift_date}`);
    } else {
      const scheduleId = uuidv4();
      await db.run(`
        INSERT INTO staff_schedules (
          id, restaurant_id, user_id, shift_date, shift_start_time,
          shift_end_time, position, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        scheduleId,
        restaurantId,
        schedule.user_id,
        schedule.shift_date,
        schedule.shift_start_time,
        schedule.shift_end_time,
        schedule.position || null,
        schedule.notes || null
      ]);
      created.push(scheduleId);
    }
  }

  await DatabaseService.getInstance().logAudit(
    restaurantId,
    userId,
    'bulk_create_schedule',
    'staff_schedule',
    '',
    { created: created.length, conflicts: conflicts.length }
  );

  res.json({
    success: true,
    data: {
      created: created.length,
      conflicts: conflicts.length,
      conflictDetails: conflicts
    }
  });
}));

/**
 * POST /api/staff/scheduling/publish
 * Publish all schedules for a date range
 */
router.post('/publish', asyncHandler(async (req: Request, res: Response) => {
  const { startDate, endDate } = req.body;
  const restaurantId = (req as any).user?.restaurantId;
  const userId = (req as any).user?.id;

  if (!startDate || !endDate) {
    return res.status(400).json({
      success: false,
      error: { message: 'startDate and endDate are required' }
    });
  }

  const db = DatabaseService.getInstance().getDatabase();

  const result = await db.run(`
    UPDATE staff_schedules
    SET is_published = true, updated_at = CURRENT_TIMESTAMP
    WHERE restaurant_id = ?
      AND shift_date >= ?
      AND shift_date <= ?
  `, [restaurantId, startDate, endDate]);

  await eventBus.emit('staff.schedule_published', {
    restaurantId,
    type: 'staff.schedule_published',
    actor: { actorType: 'user', actorId: userId },
    payload: { startDate, endDate, count: result.changes },
    occurredAt: new Date().toISOString()
  });

  logger.info(`Published ${result.changes} schedules for ${startDate} to ${endDate}`);

  res.json({
    success: true,
    data: {
      published: result.changes,
      startDate,
      endDate
    }
  });
}));

/**
 * GET /api/staff/scheduling/availability/:userId
 * Get staff availability preferences
 */
router.get('/availability/:userId', asyncHandler(async (req: Request, res: Response) => {
  const { userId } = req.params;
  const restaurantId = (req as any).user?.restaurantId;

  const db = DatabaseService.getInstance().getDatabase();

  // Verify user belongs to restaurant
  const user = await db.get(`
    SELECT id FROM users WHERE id = ? AND restaurant_id = ?
  `, [userId, restaurantId]);

  if (!user) {
    return res.status(404).json({
      success: false,
      error: { message: 'User not found' }
    });
  }

  const availability = await db.all(`
    SELECT * FROM staff_availability WHERE user_id = ? ORDER BY day_of_week
  `, [userId]);

  res.json({
    success: true,
    data: { availability }
  });
}));

/**
 * PUT /api/staff/scheduling/availability/:userId
 * Update staff availability preferences
 */
router.put('/availability/:userId', asyncHandler(async (req: Request, res: Response) => {
  const { userId } = req.params;
  const data: AvailabilityData = req.body;
  const restaurantId = (req as any).user?.restaurantId;
  const currentUserId = (req as any).user?.id;

  const db = DatabaseService.getInstance().getDatabase();

  const availabilityId = uuidv4();

  // Check if availability exists for this day
  const existing = await db.get(`
    SELECT id FROM staff_availability WHERE user_id = ? AND day_of_week = ?
  `, [userId, data.day_of_week]);

  if (existing) {
    await db.run(`
      UPDATE staff_availability
      SET is_available = ?, preferred_start_time = ?, preferred_end_time = ?, max_hours = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [
      data.is_available ?? true,
      data.preferred_start_time || null,
      data.preferred_end_time || null,
      data.max_hours || null,
      existing.id
    ]);
  } else {
    await db.run(`
      INSERT INTO staff_availability (
        id, user_id, day_of_week, is_available, preferred_start_time, preferred_end_time, max_hours
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      availabilityId,
      userId,
      data.day_of_week,
      data.is_available ?? true,
      data.preferred_start_time || null,
      data.preferred_end_time || null,
      data.max_hours || null
    ]);
  }

  res.json({
    success: true,
    data: { message: 'Availability updated successfully' }
  });
}));

/**
 * GET /api/staff/scheduling/templates
 * Get shift templates
 */
router.get('/templates', asyncHandler(async (req: Request, res: Response) => {
  const { active } = req.query;
  const restaurantId = (req as any).user?.restaurantId;

  const db = DatabaseService.getInstance().getDatabase();

  let query = 'SELECT * FROM shift_templates WHERE restaurant_id = ?';
  const params: any[] = [restaurantId];

  if (active !== undefined) {
    query += ' AND is_active = ?';
    params.push(active === 'true');
  }

  query += ' ORDER BY name';

  const templates = await db.all(query, params);

  res.json({
    success: true,
    data: { templates }
  });
}));

/**
 * POST /api/staff/scheduling/templates
 * Create a shift template
 */
router.post('/templates', asyncHandler(async (req: Request, res: Response) => {
  const data: ShiftTemplateData = req.body;
  const restaurantId = (req as any).user?.restaurantId;
  const userId = (req as any).user?.id;

  if (!data.name || !data.start_time || !data.end_time) {
    return res.status(400).json({
      success: false,
      error: { message: 'Missing required fields: name, start_time, end_time' }
    });
  }

  const db = DatabaseService.getInstance().getDatabase();

  const templateId = uuidv4();

  await db.run(`
    INSERT INTO shift_templates (
      id, restaurant_id, name, start_time, end_time, break_minutes, position, color
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    templateId,
    restaurantId,
    data.name,
    data.start_time,
    data.end_time,
    data.break_minutes || 0,
    data.position || null,
    data.color || '#14B8A6'
  ]);

  logger.info(`Shift template created: ${templateId}`);

  res.status(201).json({
    success: true,
    data: { id: templateId, ...data }
  });
}));

/**
 * PUT /api/staff/scheduling/templates/:id
 * Update a shift template
 */
router.put('/templates/:id', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const data: Partial<ShiftTemplateData> = req.body;
  const restaurantId = (req as any).user?.restaurantId;

  const db = DatabaseService.getInstance().getDatabase();

  const existing = await db.get(`
    SELECT * FROM shift_templates WHERE id = ? AND restaurant_id = ?
  `, [id, restaurantId]);

  if (!existing) {
    return res.status(404).json({
      success: false,
      error: { message: 'Template not found' }
    });
  }

  const updates: string[] = [];
  const params: any[] = [];

  if (data.name !== undefined) {
    updates.push('name = ?');
    params.push(data.name);
  }
  if (data.start_time !== undefined) {
    updates.push('start_time = ?');
    params.push(data.start_time);
  }
  if (data.end_time !== undefined) {
    updates.push('end_time = ?');
    params.push(data.end_time);
  }
  if (data.break_minutes !== undefined) {
    updates.push('break_minutes = ?');
    params.push(data.break_minutes);
  }
  if (data.position !== undefined) {
    updates.push('position = ?');
    params.push(data.position);
  }
  if (data.color !== undefined) {
    updates.push('color = ?');
    params.push(data.color);
  }
  if (data.is_active !== undefined) {
    updates.push('is_active = ?');
    params.push(data.is_active);
  }

  updates.push('updated_at = CURRENT_TIMESTAMP');
  params.push(id);

  await db.run(`
    UPDATE shift_templates SET ${updates.join(', ')} WHERE id = ?
  `, params);

  res.json({
    success: true,
    data: { message: 'Template updated successfully' }
  });
}));

/**
 * DELETE /api/staff/scheduling/templates/:id
 * Delete a shift template
 */
router.delete('/templates/:id', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const restaurantId = (req as any).user?.restaurantId;

  const db = DatabaseService.getInstance().getDatabase();

  const result = await db.run(`
    DELETE FROM shift_templates WHERE id = ? AND restaurant_id = ?
  `, [id, restaurantId]);

  if (result.changes === 0) {
    return res.status(404).json({
      success: false,
      error: { message: 'Template not found' }
    });
  }

  res.json({
    success: true,
    data: { message: 'Template deleted successfully' }
  });
}));

/**
 * GET /api/staff/scheduling/summary
 * Get staffing summary for a date range
 */
router.get('/summary', asyncHandler(async (req: Request, res: Response) => {
  const { startDate, endDate } = req.query;
  const restaurantId = (req as any).user?.restaurantId;

  if (!startDate || !endDate) {
    return res.status(400).json({
      success: false,
      error: { message: 'startDate and endDate are required' }
    });
  }

  const db = DatabaseService.getInstance().getDatabase();

  const summary = await db.all(`
    SELECT
      shift_date,
      COUNT(*) as scheduled_staff,
      COUNT(CASE WHEN is_published THEN 1 END) as published_shifts,
      MIN(shift_start_time) as earliest_shift,
      MAX(shift_end_time) as latest_shift
    FROM staff_schedules
    WHERE restaurant_id = ?
      AND shift_date >= ?
      AND shift_date <= ?
    GROUP BY shift_date
    ORDER BY shift_date
  `, [restaurantId, startDate, endDate]);

  res.json({
    success: true,
    data: { summary }
  });
}));

export default router;
