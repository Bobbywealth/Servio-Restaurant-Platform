import { Router, Request, Response } from 'express';
import { DatabaseService } from '../services/DatabaseService';
import { asyncHandler } from '../middleware/errorHandler';
import { v4 as uuidv4 } from 'uuid';
import { eventBus } from '../events/bus';

const router = Router();

interface BulkUpdateData {
  userIds: string[];
  role?: 'staff' | 'manager';
  isActive?: boolean;
  email?: string;
  position?: string;
}

/**
 * POST /api/staff/bulk/update
 * Bulk update staff members
 */
router.post('/update', asyncHandler(async (req: Request, res: Response) => {
  const data: BulkUpdateData = req.body;
  const restaurantId = (req as any).restaurantId;
  const userId = (req as any).userId;

  if (!Array.isArray(data.userIds) || data.userIds.length === 0) {
    return res.status(400).json({
      success: false,
      error: { message: 'userIds array is required' }
    });
  }

  const db = DatabaseService.getInstance().getDatabase();

  let updated = 0;
  const errors: string[] = [];

  for (const id of data.userIds) {
    try {
      // Verify user belongs to restaurant
      const user = await db.get(`
        SELECT id FROM users WHERE id = ? AND restaurant_id = ?
      `, [id, restaurantId]);

      if (!user) {
        errors.push(`User ${id} not found`);
        continue;
      }

      const updates: string[] = [];
      const params: any[] = [];

      if (data.role !== undefined) {
        updates.push('role = ?');
        params.push(data.role);
      }
      if (data.isActive !== undefined) {
        updates.push('is_active = ?');
        params.push(data.isActive);
      }
      if (data.email !== undefined) {
        updates.push('email = ?');
        params.push(data.email || null);
      }

      if (updates.length === 0) {
        errors.push(`No updates provided for ${id}`);
        continue;
      }

      updates.push('updated_at = CURRENT_TIMESTAMP');
      params.push(id);

      const result = await db.run(`
        UPDATE users SET ${updates.join(', ')} WHERE id = ?
      `, params);

      if (result.changes > 0) {
        updated++;
      }
    } catch (err: any) {
      errors.push(`Error updating ${id}: ${err.message}`);
    }
  }

  await DatabaseService.getInstance().logAudit(
    restaurantId,
    userId,
    'bulk_update_staff',
    'user',
    '',
    { userIds: data.userIds, updated, errors: errors.length }
  );

  await eventBus.emit('staff.bulk_updated', {
    restaurantId,
    type: 'staff.bulk_updated',
    actor: { actorType: 'user', actorId: userId },
    payload: { count: updated, userIds: data.userIds },
    occurredAt: new Date().toISOString()
  });

  res.json({
    success: true,
    data: {
      updated,
      attempted: data.userIds.length,
      errors: errors.length,
      errorDetails: errors
    }
  });
}));

/**
 * POST /api/staff/bulk/deactivate
 * Bulk deactivate staff members
 */
router.post('/deactivate', asyncHandler(async (req: Request, res: Response) => {
  const { userIds } = req.body;
  const restaurantId = (req as any).restaurantId;
  const currentUserId = (req as any).userId;

  if (!Array.isArray(userIds) || userIds.length === 0) {
    return res.status(400).json({
      success: false,
      error: { message: 'userIds array is required' }
    });
  }

  const db = DatabaseService.getInstance().getDatabase();

  // Prevent deactivating yourself
  if (userIds.includes(currentUserId)) {
    return res.status(400).json({
      success: false,
      error: { message: 'Cannot deactivate yourself' }
    });
  }

  const placeholders = userIds.map(() => '?').join(',');
  const result = await db.run(`
    UPDATE users
    SET is_active = false, updated_at = CURRENT_TIMESTAMP
    WHERE id IN (${placeholders}) AND restaurant_id = ?
  `, [...userIds, restaurantId]);

  await DatabaseService.getInstance().logAudit(
    restaurantId,
    currentUserId,
    'bulk_deactivate_staff',
    'user',
    '',
    { userIds, deactivated: result.changes }
  );

  await eventBus.emit('staff.bulk_deactivated', {
    restaurantId,
    type: 'staff.bulk_deactivated',
    actor: { actorType: 'user', actorId: currentUserId },
    payload: { count: result.changes, userIds },
    occurredAt: new Date().toISOString()
  });

  res.json({
    success: true,
    data: {
      deactivated: result.changes,
      attempted: userIds.length
    }
  });
}));

/**
 * POST /api/staff/bulk/activate
 * Bulk activate staff members
 */
router.post('/activate', asyncHandler(async (req: Request, res: Response) => {
  const { userIds } = req.body;
  const restaurantId = (req as any).restaurantId;
  const currentUserId = (req as any).userId;

  if (!Array.isArray(userIds) || userIds.length === 0) {
    return res.status(400).json({
      success: false,
      error: { message: 'userIds array is required' }
    });
  }

  const db = DatabaseService.getInstance().getDatabase();

  const placeholders = userIds.map(() => '?').join(',');
  const result = await db.run(`
    UPDATE users
    SET is_active = true, updated_at = CURRENT_TIMESTAMP
    WHERE id IN (${placeholders}) AND restaurant_id = ?
  `, [...userIds, restaurantId]);

  await DatabaseService.getInstance().logAudit(
    restaurantId,
    currentUserId,
    'bulk_activate_staff',
    'user',
    '',
    { userIds, activated: result.changes }
  );

  await eventBus.emit('staff.bulk_activated', {
    restaurantId,
    type: 'staff.bulk_activated',
    actor: { actorType: 'user', actorId: currentUserId },
    payload: { count: result.changes, userIds },
    occurredAt: new Date().toISOString()
  });

  res.json({
    success: true,
    data: {
      activated: result.changes,
      attempted: userIds.length
    }
  });
}));

/**
 * POST /api/staff/bulk/delete
 * Bulk delete staff members
 */
router.post('/delete', asyncHandler(async (req: Request, res: Response) => {
  const { userIds } = req.body;
  const restaurantId = (req as any).restaurantId;
  const currentUserId = (req as any).userId;

  if (!Array.isArray(userIds) || userIds.length === 0) {
    return res.status(400).json({
      success: false,
      error: { message: 'userIds array is required' }
    });
  }

  const db = DatabaseService.getInstance().getDatabase();

  // Prevent deleting yourself
  if (userIds.includes(currentUserId)) {
    return res.status(400).json({
      success: false,
      error: { message: 'Cannot delete yourself' }
    });
  }

  const placeholders = userIds.map(() => '?').join(',');

  // Get users before deletion for audit
  const usersToDelete = await db.all(`
    SELECT id, name, email FROM users WHERE id IN (${placeholders}) AND restaurant_id = ?
  `, [...userIds, restaurantId]);

  const result = await db.run(`
    DELETE FROM users WHERE id IN (${placeholders}) AND restaurant_id = ?
  `, [...userIds, restaurantId]);

  await DatabaseService.getInstance().logAudit(
    restaurantId,
    currentUserId,
    'bulk_delete_staff',
    'user',
    '',
    { userIds, deleted: result.changes, users: usersToDelete }
  );

  await eventBus.emit('staff.bulk_deleted', {
    restaurantId,
    type: 'staff.bulk_deleted',
    actor: { actorType: 'user', actorId: currentUserId },
    payload: { count: result.changes, userIds, users: usersToDelete },
    occurredAt: new Date().toISOString()
  });

  res.json({
    success: true,
    data: {
      deleted: result.changes,
      attempted: userIds.length
    }
  });
}));

/**
 * POST /api/staff/bulk/reset-pins
 * Bulk reset PINs for staff members
 */
router.post('/reset-pins', asyncHandler(async (req: Request, res: Response) => {
  const { userIds } = req.body;
  const restaurantId = (req as any).restaurantId;
  const currentUserId = (req as any).userId;

  if (!Array.isArray(userIds) || userIds.length === 0) {
    return res.status(400).json({
      success: false,
      error: { message: 'userIds array is required' }
    });
  }

  const db = DatabaseService.getInstance().getDatabase();

  let reset = 0;
  const pinSheet: Array<{ name: string; pin: string; role: string }> = [];

  for (const id of userIds) {
    const newPin = Math.floor(1000 + Math.random() * 9000).toString();

    const result = await db.run(`
      UPDATE users
      SET pin = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND restaurant_id = ?
    `, [newPin, id, restaurantId]);

    if (result.changes > 0) {
      reset++;

      // Get user details for PIN sheet
      const user = await db.get(`
        SELECT name, role FROM users WHERE id = ?
      `, [id]);

      if (user) {
        pinSheet.push({
          name: user.name,
          pin: newPin,
          role: user.role
        });
      }
    }
  }

  await DatabaseService.getInstance().logAudit(
    restaurantId,
    currentUserId,
    'bulk_reset_pins',
    'user',
    '',
    { userIds, reset }
  );

  await eventBus.emit('staff.pins_reset', {
    restaurantId,
    type: 'staff.pins_reset',
    actor: { actorType: 'user', actorId: currentUserId },
    payload: { count: reset, userIds },
    occurredAt: new Date().toISOString()
  });

  res.json({
    success: true,
    data: {
      reset,
      attempted: userIds.length,
      pinSheet
    }
  });
}));

/**
 * POST /api/staff/bulk/schedule
 * Bulk schedule staff members
 */
router.post('/schedule', asyncHandler(async (req: Request, res: Response) => {
  const { schedules }: { schedules: Array<{ userId: string; date: string; shiftTemplateId?: string }> } = req.body;
  const restaurantId = (req as any).restaurantId;
  const userId = (req as any).userId;

  if (!Array.isArray(schedules) || schedules.length === 0) {
    return res.status(400).json({
      success: false,
      error: { message: 'schedules array is required' }
    });
  }

  const db = DatabaseService.getInstance().getDatabase();

  let created = 0;
  const conflicts: string[] = [];

  for (const schedule of schedules) {
    let startTime, endTime, position;

    // If shift template is provided, use its times
    if (schedule.shiftTemplateId) {
      const template = await db.get(`
        SELECT start_time, end_time, position FROM shift_templates WHERE id = ? AND restaurant_id = ?
      `, [schedule.shiftTemplateId, restaurantId]);

      if (template) {
        startTime = template.start_time;
        endTime = template.end_time;
        position = template.position;
      }
    }

    if (!startTime || !endTime) {
      conflicts.push(`Invalid template or missing times for ${schedule.userId}`);
      continue;
    }

    // Check for conflicts
    const conflict = await db.get(`
      SELECT * FROM staff_schedules
      WHERE user_id = ? AND shift_date = ? AND restaurant_id = ?
        AND (
          (shift_start_time < ? AND shift_end_time > ?) OR
          (shift_start_time >= ? AND shift_start_time < ?)
        )
    `, [schedule.userId, schedule.date, restaurantId, startTime, endTime, startTime, endTime]);

    if (conflict) {
      conflicts.push(`${schedule.userId}:${schedule.date}`);
    } else {
      const scheduleId = uuidv4();
      await db.run(`
        INSERT INTO staff_schedules (
          id, restaurant_id, user_id, shift_date, shift_start_time, shift_end_time, position
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [scheduleId, restaurantId, schedule.userId, schedule.date, startTime, endTime, position]);

      created++;
    }
  }

  await DatabaseService.getInstance().logAudit(
    restaurantId,
    userId,
    'bulk_schedule_staff',
    'staff_schedule',
    '',
    { schedules: schedules.length, created, conflicts: conflicts.length }
  );

  res.json({
    success: true,
    data: {
      created,
      attempted: schedules.length,
      conflicts: conflicts.length,
      conflictDetails: conflicts
    }
  });
}));

export default router;
