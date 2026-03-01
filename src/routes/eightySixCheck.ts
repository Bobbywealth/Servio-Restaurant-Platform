import { Router, Request, Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { requireAuth } from '../middleware/auth';
import { VoiceOrderingService } from '../services/VoiceOrderingService';
import { DatabaseService } from '../services/DatabaseService';
import { logger } from '../utils/logger';
import { eventBus } from '../events/bus';

const router = Router();

interface EightySixCheckRequest {
  restaurantId: string;
  phoneNumber: string;
  scheduledTime?: string; // ISO format
  checkType: 'full' | 'quick' | 'custom';
}

interface EightySixCheckResult {
  checkId: string;
  restaurantId: string;
  callId?: string;
  itemsBefore: Array<{id: string; name: string; available: boolean}>;
  itemsConfirmed: Array<{id: string; name: string; stillUnavailable: boolean}>;
  itemsUpdated: Array<{id: string; name: string; newStatus: boolean}>;
  staffName?: string;
  durationSeconds?: number;
  status: 'completed' | 'failed' | 'partial' | 'in-progress';
  notes?: string;
}

/**
 * GET /api/86-check/status/:restaurantId
 * Get current 86 check status and history
 */
router.get('/status/:restaurantId', requireAuth, asyncHandler(async (req: Request, res: Response) => {
  const { restaurantId } = req.params;
  const db = DatabaseService.getInstance().getDatabase();
  
  // Get currently unavailable items
  const unavailableItems = await db.all(
    `SELECT id, name, base_price, category_id 
     FROM menu_items 
     WHERE restaurant_id = ? AND is_available = FALSE`,
    [restaurantId]
  );
  
  // Get recent 86 check history
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
      nextScheduledCheck: null // TODO: Get from cron
    }
  });
}));

/**
 * POST /api/86-check/trigger
 * Manually trigger an 86 check call
 */
router.post('/trigger', requireAuth, asyncHandler(async (req: Request, res: Response) => {
  const { restaurantId, phoneNumber, checkType = 'quick' }: EightySixCheckRequest = req.body;
  
  if (!restaurantId || !phoneNumber) {
    res.status(400).json({
      success: false,
      error: 'restaurantId and phoneNumber are required'
    });
    return;
  }
  
  const db = DatabaseService.getInstance().getDatabase();
  
  // Get currently unavailable items (these will be verified)
  const unavailableItems = await db.all(
    `SELECT id, name 
     FROM menu_items 
     WHERE restaurant_id = ? AND is_available = FALSE
     ORDER BY name`,
    [restaurantId]
  );
  
  // Create check record
  const checkId = `86check_${Date.now()}`;
  await db.run(
    `INSERT INTO eighty_six_checks (id, restaurant_id, started_at, items_checked, status)
     VALUES (?, ?, CURRENT_TIMESTAMP, ?, ?)`,
    [checkId, restaurantId, JSON.stringify(unavailableItems), 'in-progress']
  );
  
  // Emit event for call initiation
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
  
  // Get check record
  const check = await db.get(
    'SELECT * FROM eighty_six_checks WHERE id = ?',
    [checkId]
  );
  
  if (!check) {
    res.status(404).json({ success: false, error: 'Check not found' });
    return;
  }
  
  // Process results and update availability
  const itemsUpdated: Array<{id: string; name: string; newStatus: boolean}> = [];
  
  for (const item of results) {
    if (item.updateRequired) {
      // Update item availability
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
      
      // Log audit
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
  
  // Update check record
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
  
  // Emit completion event
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
  
  // times should be array like ["09:00", "14:00", "18:00"]
  
  const db = DatabaseService.getInstance().getDatabase();
  
  await db.run(
    `UPDATE restaurants 
     SET eighty_six_check_schedule = ? 
     WHERE id = ?`,
    [JSON.stringify({ times, enabled }), restaurantId]
  );
  
  // TODO: Update actual cron jobs
  
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
