import { Router, Request, Response } from 'express';
import { DatabaseService } from '../services/DatabaseService';
import { asyncHandler } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

const router = Router();

/**
 * TEMPORARY: Clear Vapi phoneNumberId from platform-admin-org
 * This fixes the issue where phoneNumberId was saved to wrong restaurant
 */
router.post('/fix-vapi-mapping', asyncHandler(async (req: Request, res: Response) => {
  const db = DatabaseService.getInstance().getDatabase();
  
  // Get platform-admin-org settings
  const platformAdmin = await db.get(
    'SELECT id, settings FROM restaurants WHERE id = ?',
    ['platform-admin-org']
  );
  
  if (!platformAdmin) {
    return res.json({ success: true, message: 'platform-admin-org not found, nothing to fix' });
  }
  
  let settings: Record<string, any> = {};
  try {
    settings = JSON.parse(platformAdmin.settings || '{}');
  } catch (e) {
    settings = {};
  }
  
  // Clear vapi settings from platform-admin-org
  if (settings.vapi) {
    delete settings.vapi;
    await db.run(
      'UPDATE restaurants SET settings = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [JSON.stringify(settings), 'platform-admin-org']
    );
    logger.info('Cleared Vapi settings from platform-admin-org');
    return res.json({ success: true, message: 'Cleared Vapi settings from platform-admin-org' });
  }
  
  res.json({ success: true, message: 'No Vapi settings found on platform-admin-org' });
}));

router.post('/seed-menu', asyncHandler(async (req: Request, res: Response) => {
  const { seedMenuItems } = await import('../scripts/seed-menu-items');
  await seedMenuItems();
  res.json({ success: true, message: 'Menu items seeded successfully' });
}));

router.post('/seed-foodbooking-modifiers', asyncHandler(async (req: Request, res: Response) => {
  const { seedFoodbookingModifiers } = await import('../scripts/seed-foodbooking-modifiers');
  await seedFoodbookingModifiers();
  res.json({ success: true, message: 'Foodbooking modifiers seeded successfully' });
}));

export default router;
