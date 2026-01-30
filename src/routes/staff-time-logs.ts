import { Router, Request, Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { DatabaseService } from '../services/DatabaseService';
import { logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

/**
 * GET /api/staff/time-logs/:id
 * Get a single time entry
 */
router.get('/staff/time-logs/:id', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const restaurantId = (req as any).restaurantId;

  const db = DatabaseService.getInstance().getDatabase();

  const entry = await db.get(
    'SELECT te.*, u.name as staff_name, u.role as staff_role FROM time_entries te JOIN users u ON te.user_id = u.id WHERE te.id = ? AND te.restaurant_id = ?',
    [id, restaurantId]
  );

  if (!entry) {
    return res.status(404).json({
      success: false,
      error: { message: 'Time entry not found' }
    });
  }

  res.json({
    success: true,
    data: { entry }
  });
});

/**
 * PUT /api/staff/time-logs/:id
 * Update a time entry
 */
router.put('/staff/time-logs/:id', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { user_id, clock_in_time, clock_out_time, break_minutes, notes } = req.body;
  const restaurantId = (req as any).restaurantId;
  const requestingUserId = (req as any).userId;

  const db = DatabaseService.getInstance().getDatabase();

  // Verify entry exists and belongs to this restaurant
  const existing = await db.get(
    'SELECT * FROM time_entries WHERE id = ? AND restaurant_id = ?',
    [id, restaurantId]
  );

  if (!existing) {
    return res.status(404).json({
      success: false,
      error: { message: 'Time entry not found' }
    });
  }

  // Only staff themselves, or an admin/manager can edit time entries
  const user = await db.get<any>(
    'SELECT role FROM users WHERE id = ?',
    [requestingUserId]
  );

  if (!user) {
    return res.status(404).json({
      success: false,
      error: { { message: 'User not found' }
    });
  }

  const canEdit = ['admin', 'manager', 'owner'].includes(user.role);

  if (!canEdit) {
    return res.status(403).json({
      success: false,
      error: { message: 'You do not have permission to edit time entries' }
    });
  }

  // Validate required fields
  if (!clock_in_time) {
    return res.status(400).json({
      success: false,
      error: { message: 'clock_in_time is required' }
    });
  }

  const updates: string[] = [];
  const params: any[] = [];

  if (break_minutes !== undefined && break_minutes !== null) {
    updates.push('break_minutes = ?');
    params.push(break_minutes);
  }

  if (notes !== undefined && notes !== null) {
    updates.push('notes = ?');
    params.push(notes);
  }

  if (clock_out_time) {
    updates.push('clock_out_time = ?');
    params.push(clock_out_time);
  }

  updates.push('updated_at = CURRENT_TIMESTAMP');
  params.push(id, restaurantId);

  await db.run(
    `UPDATE time_entries SET ${updates.join(', ')} WHERE id = ? AND restaurant_id = ?`,
      params
  );

  await DatabaseService.getInstance().logAudit(
    restaurantId,
    requestingUserId,
    'update_time_entry',
    'time_entry',
    id,
    { fields: updates.join(', ') }
  );

  res.json({
    success: true,
    data: { message: 'Time entry updated successfully' }
  });
});

/**
 * POST /api/staff/time-logs
 * Create a manual time entry
 */
router.post('/staff/time-logs', asyncHandler(async (req: Request, res: Response) => {
  const { user_id, clock_in_time, break_minutes, notes, position } = req.body;
  const restaurantId = (req as any).restaurantId;
  const requestingUserId = (req as any).userId;

  const db = DatabaseService.getInstance().getDatabase();

  // Verify user exists and belongs to restaurant
  const user = await db.get<any>(
    'SELECT role FROM users WHERE id = ? AND restaurant_id = ?',
    [user_id, restaurantId]
  );

  if (!user) {
    return res.status(404).json({
      success: false,
      error: { message: 'User not found' }
    });
  }

  const canCreate = ['admin', 'manager', 'owner', 'staff'].includes(user.role);

  if (!canCreate) {
    return res.status(403).json({
      success: false,
      error: { message: 'You do not have permission to create time entries' }
    });
  }

  if (!clock_in_time) {
    return res.status(400).json({
      success: false,
      error: { message: 'clock_in_time is required' }
    });
  }

  const timeEntryId = uuidv4();
  const now = new Date().toISOString();

  await db.run(
    `INSERT INTO time_entries (id, restaurant_id, user_id, clock_in_time, break_minutes, position, total_hours, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    [timeEntryId, restaurantId, user_id, clock_in_time, break_minutes, position || null]
  );

  await DatabaseService.getInstance().logAudit(
    restaurantId,
    requestingUserId,
    'create_time_entry',
    'time_entry',
    timeEntryId,
    {}
  );

  // Emit event for real-time updates
  const eventBus = await import('../events/bus').then(m => m.default);
  eventBus.emit('staff.time_entry_created', {
    restaurantId,
    type: 'staff.time_entry_created',
    actor: { actorType: 'user', actorId: user_id },
    payload: { timeEntryId, userId: user_id },
    occurredAt: now
  });

  res.status(201).json({
    success: true,
    data: {
      id: timeEntryId,
      message: 'Time entry created successfully'
    }
  });
});

/**
 * GET /api/staff/time-logs/manual/:userId
 * Get manual entries for a specific user (for editing)
 */
router.get('/staff/time-logs/manual/:userId', asyncHandler(async (req: Request, res: Response) => {
  const { userId } = req.params;
  const restaurantId = (req as any).restaurantId;

  const db = DatabaseService.getInstance().getDatabase();

  // Get only manually created entries (without clock_in_time from POS)
  const entries = await db.all(`
    SELECT te.*, u.name as staff_name, u.role as staff_role
    FROM time_entries te
    JOIN users u ON te.user_id = u.id
    WHERE te.restaurant_id = ? AND te.created_manually = 1
    ORDER BY te.created_at DESC
  `, [restaurantId, userId]);

  res.json({
    success: true,
    data: { entries }
  });
});

export default router;
