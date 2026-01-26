import { Router, Request, Response } from 'express';
import { DatabaseService } from '../services/DatabaseService';
import { BrowserAutomationService } from '../services/BrowserAutomationService';
import { asyncHandler, BadRequestError, UnauthorizedError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

const router = Router();
const automationService = BrowserAutomationService.getInstance();

/**
 * GET /api/delivery-platforms/credentials
 * Get all delivery platform credentials for the restaurant
 */
router.get('/credentials', asyncHandler(async (req: Request, res: Response) => {
  const restaurantId = req.user?.restaurantId;

  if (!restaurantId) {
    throw new UnauthorizedError('Restaurant ID required');
  }

  const credentials = await automationService.getAllCredentials(restaurantId);

  // Don't send encrypted passwords to client
  const safeCredentials = credentials.map(cred => ({
    id: cred.id,
    platform: cred.platform,
    username: cred.username,
    portalUrl: cred.portalUrl,
    isActive: cred.isActive,
    syncConfig: cred.syncConfig
  }));

  res.json({
    success: true,
    data: safeCredentials
  });
}));

/**
 * POST /api/delivery-platforms/credentials
 * Save new delivery platform credentials
 */
router.post('/credentials', asyncHandler(async (req: Request, res: Response) => {
  const restaurantId = req.user?.restaurantId;
  const { platform, username, password, portalUrl, syncConfig } = req.body;

  if (!restaurantId) {
    throw new UnauthorizedError('Restaurant ID required');
  }

  if (!platform || !username || !password) {
    throw new BadRequestError('Platform, username, and password are required');
  }

  const validPlatforms = ['doordash', 'ubereats', 'grubhub', 'postmates'];
  if (!validPlatforms.includes(platform)) {
    throw new BadRequestError(`Invalid platform. Must be one of: ${validPlatforms.join(', ')}`);
  }

  // Check if credentials already exist
  const existing = await automationService.getCredentials(restaurantId, platform);
  if (existing) {
    throw new BadRequestError(`Credentials for ${platform} already exist. Use PUT to update.`);
  }

  const credentials = await automationService.saveCredentials({
    restaurantId,
    platform,
    username,
    password,
    portalUrl,
    syncConfig
  });

  await DatabaseService.getInstance().logAudit(
    restaurantId,
    req.user?.id || 'system',
    'create_platform_credentials',
    'delivery_platform_credentials',
    credentials.id,
    { platform, username }
  );

  res.status(201).json({
    success: true,
    data: {
      id: credentials.id,
      platform: credentials.platform,
      username: credentials.username,
      portalUrl: credentials.portalUrl,
      isActive: credentials.isActive
    }
  });
}));

/**
 * PUT /api/delivery-platforms/credentials/:platform
 * Update delivery platform credentials
 */
router.put('/credentials/:platform', asyncHandler(async (req: Request, res: Response) => {
  const restaurantId = req.user?.restaurantId;
  const platform = Array.isArray(req.params.platform) ? req.params.platform[0] : req.params.platform;
  const { username, password, portalUrl, syncConfig, isActive } = req.body;

  if (!restaurantId) {
    throw new UnauthorizedError('Restaurant ID required');
  }

  // Get existing credentials
  const existing = await automationService.getCredentials(restaurantId, platform);
  if (!existing) {
    throw new BadRequestError(`No credentials found for ${platform}`);
  }

  const db = DatabaseService.getInstance().getDatabase();

  // Build update query
  const updates: string[] = [];
  const values: any[] = [];

  if (username !== undefined) {
    updates.push('username = ?');
    values.push(username);
  }

  if (password !== undefined) {
    updates.push('password_encrypted = ?');
    values.push(automationService.encryptPassword(password));
  }

  if (portalUrl !== undefined) {
    updates.push('portal_url = ?');
    values.push(portalUrl);
  }

  if (syncConfig !== undefined) {
    updates.push('sync_config = ?');
    values.push(JSON.stringify(syncConfig));
  }

  if (isActive !== undefined) {
    updates.push('is_active = ?');
    values.push(isActive ? 1 : 0);
  }

  updates.push('updated_at = CURRENT_TIMESTAMP');

  values.push(existing.id);

  await db.run(`
    UPDATE delivery_platform_credentials
    SET ${updates.join(', ')}
    WHERE id = ?
  `, values);

  await DatabaseService.getInstance().logAudit(
    restaurantId,
    req.user?.id || 'system',
    'update_platform_credentials',
    'delivery_platform_credentials',
    existing.id,
    { platform, updates: Object.keys(req.body) }
  );

  res.json({
    success: true,
    message: 'Credentials updated successfully'
  });
}));

/**
 * DELETE /api/delivery-platforms/credentials/:platform
 * Delete delivery platform credentials
 */
router.delete('/credentials/:platform', asyncHandler(async (req: Request, res: Response) => {
  const restaurantId = req.user?.restaurantId;
  const platform = Array.isArray(req.params.platform) ? req.params.platform[0] : req.params.platform;

  if (!restaurantId) {
    throw new UnauthorizedError('Restaurant ID required');
  }

  const db = DatabaseService.getInstance().getDatabase();

  const result = await db.run(`
    DELETE FROM delivery_platform_credentials
    WHERE restaurant_id = ? AND platform = ?
  `, [restaurantId, platform]);

  if (result.changes === 0) {
    throw new BadRequestError(`No credentials found for ${platform}`);
  }

  await DatabaseService.getInstance().logAudit(
    restaurantId,
    req.user?.id || 'system',
    'delete_platform_credentials',
    'delivery_platform_credentials',
    null,
    { platform }
  );

  res.json({
    success: true,
    message: 'Credentials deleted successfully'
  });
}));

/**
 * POST /api/delivery-platforms/test-credentials
 * Test delivery platform credentials
 */
router.post('/test-credentials', asyncHandler(async (req: Request, res: Response) => {
  const { platform, username, password, portalUrl } = req.body;

  if (!platform || !username || !password) {
    throw new BadRequestError('Platform, username, and password are required');
  }

  logger.info(`Testing credentials for ${platform} - ${username}`);

  const result = await automationService.testCredentials(
    platform,
    username,
    password,
    portalUrl
  );

  res.json({
    success: result.success,
    message: result.message
  });
}));

/**
 * POST /api/delivery-platforms/sync/:platform
 * Sync menu to a specific delivery platform
 */
router.post('/sync/:platform', asyncHandler(async (req: Request, res: Response) => {
  const restaurantId = req.user?.restaurantId;
  const platform = req.params.platform as 'doordash' | 'ubereats' | 'grubhub' | 'postmates';
  const { syncType = 'full_sync' } = req.body;

  if (!restaurantId) {
    throw new UnauthorizedError('Restaurant ID required');
  }

  const validPlatforms = ['doordash', 'ubereats', 'grubhub', 'postmates'];
  if (!validPlatforms.includes(platform)) {
    throw new BadRequestError(`Invalid platform. Must be one of: ${validPlatforms.join(', ')}`);
  }

  const validSyncTypes = ['menu_update', 'stock_update', 'price_update', 'full_sync'];
  if (!validSyncTypes.includes(syncType)) {
    throw new BadRequestError(`Invalid sync type. Must be one of: ${validSyncTypes.join(', ')}`);
  }

  logger.info(`Starting ${syncType} for ${platform} - Restaurant: ${restaurantId}`);

  // Start sync (this runs in background)
  const result = await automationService.syncMenuToPlatform(
    restaurantId,
    platform,
    syncType
  );

  await DatabaseService.getInstance().logAudit(
    restaurantId,
    req.user?.id || 'system',
    'sync_to_platform',
    'delivery_platform_sync',
    null,
    { platform, syncType, result }
  );

  res.json({
    success: result.success,
    data: {
      itemsSynced: result.itemsSynced,
      itemsFailed: result.itemsFailed,
      errors: result.errors,
      details: result.details
    }
  });
}));

/**
 * POST /api/delivery-platforms/sync-all
 * Sync menu to all configured delivery platforms
 */
router.post('/sync-all', asyncHandler(async (req: Request, res: Response) => {
  const restaurantId = req.user?.restaurantId;
  const { syncType = 'full_sync' } = req.body;

  if (!restaurantId) {
    throw new UnauthorizedError('Restaurant ID required');
  }

  const credentials = await automationService.getAllCredentials(restaurantId);

  if (credentials.length === 0) {
    throw new BadRequestError('No delivery platform credentials configured');
  }

  logger.info(`Starting ${syncType} for all platforms - Restaurant: ${restaurantId}`);

  const results = await Promise.all(
    credentials.map(async (cred) => {
      try {
        const result = await automationService.syncMenuToPlatform(
          restaurantId,
          cred.platform,
          syncType
        );
        return {
          platform: cred.platform,
          ...result
        };
      } catch (error: any) {
        return {
          platform: cred.platform,
          success: false,
          itemsSynced: 0,
          itemsFailed: 0,
          errors: [error.message],
          details: {}
        };
      }
    })
  );

  const totalSynced = results.reduce((sum, r) => sum + r.itemsSynced, 0);
  const totalFailed = results.reduce((sum, r) => sum + r.itemsFailed, 0);
  const allSuccess = results.every(r => r.success);

  await DatabaseService.getInstance().logAudit(
    restaurantId,
    req.user?.id || 'system',
    'sync_to_all_platforms',
    'delivery_platform_sync',
    null,
    { syncType, results }
  );

  res.json({
    success: allSuccess,
    data: {
      totalSynced,
      totalFailed,
      platforms: results
    }
  });
}));

/**
 * GET /api/delivery-platforms/sync-logs
 * Get sync logs for the restaurant
 */
router.get('/sync-logs', asyncHandler(async (req: Request, res: Response) => {
  const restaurantId = req.user?.restaurantId;
  const { platform, limit = 50, offset = 0 } = req.query;

  if (!restaurantId) {
    throw new UnauthorizedError('Restaurant ID required');
  }

  const db = DatabaseService.getInstance().getDatabase();

  let query = `
    SELECT id, platform, sync_type, status, items_synced, items_failed,
           error_message, started_at, completed_at
    FROM delivery_platform_sync_logs
    WHERE restaurant_id = ?
  `;
  const params: any[] = [restaurantId];

  if (platform) {
    query += ' AND platform = ?';
    params.push(platform);
  }

  query += ' ORDER BY started_at DESC LIMIT ? OFFSET ?';
  params.push(Number(limit), Number(offset));

  const logs = await db.all(query, params);

  res.json({
    success: true,
    data: logs
  });
}));

/**
 * GET /api/delivery-platforms/supported
 * Get list of supported delivery platforms
 */
router.get('/supported', asyncHandler(async (req: Request, res: Response) => {
  res.json({
    success: true,
    data: [
      {
        id: 'doordash',
        name: 'DoorDash',
        description: 'DoorDash Merchant Portal',
        defaultUrl: 'https://merchant-portal.doordash.com',
        status: 'active'
      },
      {
        id: 'ubereats',
        name: 'Uber Eats',
        description: 'Uber Eats Restaurant Manager',
        defaultUrl: 'https://restaurant.uber.com',
        status: 'active'
      },
      {
        id: 'grubhub',
        name: 'Grubhub',
        description: 'Grubhub for Restaurants',
        defaultUrl: 'https://restaurant.grubhub.com',
        status: 'coming_soon'
      },
      {
        id: 'postmates',
        name: 'Postmates',
        description: 'Postmates Merchant Portal',
        defaultUrl: 'https://merchant.postmates.com',
        status: 'coming_soon'
      }
    ]
  });
}));

export default router;
