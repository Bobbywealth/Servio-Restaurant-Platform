import { Router, Request, Response } from 'express';
import { PushService } from '../services/PushService';
import { DatabaseService, DbClient } from '../services/DatabaseService';
import { asyncHandler } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

const router = Router();

// Initialize PushService lazily to avoid issues with database not being ready
let pushService: PushService | null = null;

function getPushService(): PushService {
  if (!pushService) {
    const db: DbClient = DatabaseService.getInstance().getDatabase();
    pushService = new PushService(db);
  }
  return pushService;
}

/**
 * GET /api/push/vapid-key
 * Returns the VAPID public key for the frontend to use
 */
router.get('/vapid-key', asyncHandler(async (req: Request, res: Response) => {
  const service = getPushService();
  const publicKey = service.getVapidPublicKey();

  if (!publicKey) {
    return res.status(503).json({
      success: false,
      error: 'Push notifications not configured',
      message: 'VAPID keys are not set on the server'
    });
  }

  res.json({ success: true, publicKey });
}));

/**
 * POST /api/push/subscribe
 * Register a push subscription for the current user
 */
router.post('/subscribe', asyncHandler(async (req: Request, res: Response) => {
  const user = req.user!;
  const userId = user.id;
  const restaurantId = user.restaurantId;
  const subscription = req.body.subscription;

  if (!subscription || !subscription.endpoint) {
    return res.status(400).json({
      success: false,
      error: 'Invalid subscription',
      message: 'Subscription must include an endpoint'
    });
  }

  const service = getPushService();
  const result = await service.subscribe(userId, restaurantId, subscription);

  if (!result.success) {
    return res.status(500).json({
      success: false,
      error: 'Failed to subscribe',
      message: 'Could not save push subscription'
    });
  }

  logger.info(`Push subscription created for user ${userId}`);

  res.json({
    success: true,
    data: {
      subscriptionId: result.id,
      message: 'Successfully subscribed to push notifications'
    }
  });
}));

/**
 * DELETE /api/push/unsubscribe
 * Unregister a push subscription
 */
router.delete('/unsubscribe', asyncHandler(async (req: Request, res: Response) => {
  const user = req.user!;
  const userId = user.id;
  const subscriptionId = req.body.subscriptionId;

  const service = getPushService();

  if (subscriptionId) {
    // Unsubscribe specific subscription
    const success = await service.unsubscribe(subscriptionId);
    if (!success) {
      return res.status(500).json({
        success: false,
        error: 'Failed to unsubscribe',
        message: 'Could not remove push subscription'
      });
    }
  } else {
    // Unsubscribe all for user
    await service.unsubscribeAllForUser(userId);
  }

  logger.info(`Push subscription removed for user ${userId}`);

  res.json({
    success: true,
    data: {
      message: 'Successfully unsubscribed from push notifications'
    }
  });
}));

/**
 * GET /api/push/preferences
 * Get notification preferences for the current user
 */
router.get('/preferences', asyncHandler(async (req: Request, res: Response) => {
  const user = req.user!;
  const userId = user.id;

  const service = getPushService();
  const preferences = await service.getNotificationPreferences(userId);

  res.json({
    success: true,
    data: preferences
  });
}));

/**
 * PUT /api/push/preferences
 * Update notification preferences for the current user
 */
router.put('/preferences', asyncHandler(async (req: Request, res: Response) => {
  const user = req.user!;
  const userId = user.id;
  const preferences = req.body.preferences;

  if (!preferences || typeof preferences !== 'object') {
    return res.status(400).json({
      success: false,
      error: 'Invalid preferences',
      message: 'Preferences must be an object'
    });
  }

  const service = getPushService();
  const success = await service.updateNotificationPreferences(userId, preferences);

  if (!success) {
    return res.status(500).json({
      success: false,
      error: 'Failed to update preferences',
      message: 'Could not save notification preferences'
    });
  }

  logger.info(`Notification preferences updated for user ${userId}`);

  res.json({
    success: true,
    data: {
      message: 'Successfully updated notification preferences'
    }
  });
}));

/**
 * POST /api/push/test
 * Send a test push notification to the current user
 */
router.post('/test', asyncHandler(async (req: Request, res: Response) => {
  const user = req.user!;
  const userId = user.id;

  const service = getPushService();

  // Check current notification preferences
  const prefs = await service.getNotificationPreferences(userId);
  if (prefs && !prefs.pushEnabled) {
    return res.status(400).json({
      success: false,
      error: 'Push notifications disabled',
      message: 'Please enable push notifications in your preferences'
    });
  }

  // Check quiet hours
  if (service.isInQuietHours(prefs || { quietHoursEnabled: false, quietHoursStart: '', quietHoursEnd: '' })) {
    return res.status(400).json({
      success: false,
      error: 'Quiet hours active',
      message: 'Push notifications are paused during quiet hours'
    });
  }

  const count = await service.sendToUser(userId, {
    title: 'Servio Test',
    body: 'This is a test push notification from Servio!',
    tag: 'test-notification',
    data: { test: true }
  });

  if (count === 0) {
    return res.status(404).json({
      success: false,
      error: 'No active subscriptions',
      message: 'No active push subscriptions found for this user'
    });
  }

  logger.info(`Test push notification sent to user ${userId}`);

  res.json({
    success: true,
    data: {
      message: `Test notification sent to ${count} device(s)`
    }
  });
}));

export default router;
