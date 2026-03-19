import { Router, Request, Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { requireAuth } from '../middleware/auth';
import { DatabaseService } from '../services/DatabaseService';
import { logger } from '../utils/logger';
import { eventBus } from '../events/bus';

const router = Router();

interface EightySixCheckRequest {
  restaurantId: string;
  phoneNumber: string;
  scheduledTime?: string;
  checkType: 'full' | 'quick' | 'custom';
}

/**
 * GET /api/86-check/status/:restaurantId
 * Get current 86 check status and history
 */
router.get('/status/:restaurantId', requireAuth, asyncHandler(async (req: Request, res: Response) => {
  const { restaurantId } = req.params;
  const db = DatabaseService.getInstance().getDatabase();
  
  const unavailableItems = await db.all(
    `SELECT id, name, base_price, category_id 
     FROM menu_items 
     WHERE restaurant_id = ? AND is_available = FALSE`,
    [restaurantId]
  );
  
  const recentChecks = await db.all(
    `SELECT * FROM eighty_six_checks 
     WHERE restaurant_id = ? 
     ORDER BY started_at DESC 
     LIMIT 10`,
    [restaurantId]
  );
  
  res.json({
    success: true,
    data: {
      currentlyUnavailable: unavailableItems,
      recentChecks,
      nextScheduledCheck: null
    }
  });
}));

/**
 * POST /api/86-check/trigger
 * Manually trigger an 86 check call
 */
router.post('/trigger', requireAuth, asyncHandler(async (req: Request, res: Response) => {
  const { restaurantId, phoneNumber, checkType: _checkType = 'quick' }: EightySixCheckRequest = req.body;
  
  if (!restaurantId || !phoneNumber) {
    res.status(400).json({
      success: false,
      error: 'restaurantId and phoneNumber are required'
    });
    return;
  }
  
  const db = DatabaseService.getInstance().getDatabase();
  
  const unavailableItems = await db.all(
    `SELECT id, name 
     FROM menu_items 
     WHERE restaurant_id = ? AND is_available = FALSE
     ORDER BY name`,
    [restaurantId]
  );
  
  const checkId = `86check_${Date.now()}`;
  await db.run(
    `INSERT INTO eighty_six_checks (id, restaurant_id, started_at, items_checked, status)
     VALUES (?, ?, CURRENT_TIMESTAMP, ?, ?)`,
    [checkId, restaurantId, JSON.stringify(unavailableItems), 'in-progress']
  );
  
  await eventBus.emit('86check.initiated', {
    type: '86check.initiated',
    restaurantId,
    checkId,
    phoneNumber,
    itemsToVerify: unavailableItems,
    timestamp: new Date().toISOString()
  });
  
  logger.info('[86check] Triggered', { checkId, restaurantId, phoneNumber, itemCount: unavailableItems.length });
  
  res.json({
    success: true,
    data: {
      checkId,
      restaurantId,
      phoneNumber,
      itemsToVerify: unavailableItems,
      status: 'in-progress',
      message: `86 check initiated. Will call ${phoneNumber} to verify ${unavailableItems.length} unavailable items.`
    }
  });
}));

/**
 * POST /api/86-check/result
 * Receive result from 86 check call (called by Vapi webhook)
 */
router.post('/result', asyncHandler(async (req: Request, res: Response) => {
  const { checkId, results, staffName, durationSeconds, notes } = req.body;
  
  if (!checkId || !results) {
    res.status(400).json({ success: false, error: 'checkId and results required' });
    return;
  }
  
  const db = DatabaseService.getInstance().getDatabase();
  
  const check = await db.get(
    'SELECT * FROM eighty_six_checks WHERE id = ?',
    [checkId]
  );
  
  if (!check) {
    res.status(404).json({ success: false, error: 'Check not found' });
    return;
  }
  
  const itemsUpdated: Array<{id: string; name: string; newStatus: boolean}> = [];
  
  for (const item of results) {
    if (item.updateRequired) {
      await db.run(
        `UPDATE menu_items 
         SET is_available = ?, updated_at = CURRENT_TIMESTAMP 
         WHERE id = ? AND restaurant_id = ?`,
        [item.newStatus, item.id, check.restaurant_id]
      );
      
      itemsUpdated.push({
        id: item.id,
        name: item.name,
        newStatus: item.newStatus
      });
      
      await DatabaseService.getInstance().logAudit(
        check.restaurant_id,
        null,
        'update_availability_86check',
        'menu_item',
        item.id,
        { previousStatus: !item.newStatus, newStatus: item.newStatus, source: '86check' }
      );
    }
  }
  
  await db.run(
    `UPDATE eighty_six_checks 
     SET completed_at = CURRENT_TIMESTAMP,
         items_confirmed = ?,
         items_updated = ?,
         staff_name = ?,
         duration_seconds = ?,
         notes = ?,
         status = 'completed'
     WHERE id = ?`,
    [
      JSON.stringify(results),
      JSON.stringify(itemsUpdated),
      staffName || null,
      durationSeconds || null,
      notes || null,
      checkId
    ]
  );
  
  await eventBus.emit('86check.completed', {
    type: '86check.completed',
    restaurantId: check.restaurant_id,
    checkId,
    itemsUpdated,
    timestamp: new Date().toISOString()
  });
  
  logger.info('[86check] Completed', { checkId, itemsUpdated: itemsUpdated.length });
  
  res.json({
    success: true,
    data: {
      checkId,
      itemsUpdated,
      message: `86 check completed. Updated ${itemsUpdated.length} items.`
    }
  });
}));

/**
 * GET /api/86-check/history/:restaurantId
 * Get full history of 86 checks
 */
router.get('/history/:restaurantId', requireAuth, asyncHandler(async (req: Request, res: Response) => {
  const { restaurantId } = req.params;
  const { limit = 50, offset = 0 } = req.query;
  
  const db = DatabaseService.getInstance().getDatabase();
  
  const checks = await db.all(
    `SELECT * FROM eighty_six_checks 
     WHERE restaurant_id = ? 
     ORDER BY started_at DESC 
     LIMIT ? OFFSET ?`,
    [restaurantId, limit, offset]
  );
  
  res.json({
    success: true,
    data: checks
  });
}));

/**
 * POST /api/86-check/schedule
 * Schedule recurring 86 checks
 */
router.post('/schedule', requireAuth, asyncHandler(async (req: Request, res: Response) => {
  const { restaurantId, times, enabled = true } = req.body;
  
  const db = DatabaseService.getInstance().getDatabase();
  
  await db.run(
    `UPDATE restaurants 
     SET eighty_six_check_schedule = ? 
     WHERE id = ?`,
    [JSON.stringify({ times, enabled }), restaurantId]
  );
  
  res.json({
    success: true,
    data: {
      restaurantId,
      schedule: { times, enabled },
      message: `86 checks scheduled at ${times.join(', ')}`
    }
  });
}));

export default router;
