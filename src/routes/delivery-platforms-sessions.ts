/**
 * Session Management Routes for Delivery Platforms
 *
 * These routes handle browser session persistence for multi-restaurant automation.
 */

import { Router, Request, Response } from 'express';
import { BrowserAutomationServiceWithSessions } from '../services/BrowserAutomationService.sessions';
import { asyncHandler, BadRequestError, UnauthorizedError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

const router = Router();
const sessionService = BrowserAutomationServiceWithSessions.getInstance();

/**
 * POST /api/delivery-platforms-sessions/init
 * Initialize a new session (manual login)
 *
 * This opens a browser window for the user to login manually.
 * Once logged in, the session is saved and can be reused.
 */
router.post('/init', asyncHandler(async (req: Request, res: Response) => {
  const restaurantId = req.user?.restaurantId;
  const { platform, username, password } = req.body;

  if (!restaurantId) {
    throw new UnauthorizedError('Restaurant ID required');
  }

  if (!platform || !username || !password) {
    throw new BadRequestError('Platform, username, and password are required');
  }

  const validPlatforms = ['doordash', 'ubereats'];
  if (!validPlatforms.includes(platform)) {
    throw new BadRequestError(`Invalid platform. Must be one of: ${validPlatforms.join(', ')}`);
  }

  logger.info(`Initializing session for restaurant ${restaurantId} - ${platform}`);
  logger.info(`A browser window will open. Please login manually and wait for confirmation.`);

  // This will open a browser window in headed mode
  const result = await sessionService.initSession(
    restaurantId,
    platform,
    username,
    password
  );

  res.json({
    success: result.success,
    message: result.message
  });
}));

/**
 * GET /api/delivery-platforms-sessions/status/:platform
 * Check if session exists and is valid
 */
router.get('/status/:platform', asyncHandler(async (req: Request, res: Response) => {
  const restaurantId = req.user?.restaurantId;
  const platform = req.params.platform as 'doordash' | 'ubereats';

  if (!restaurantId) {
    throw new UnauthorizedError('Restaurant ID required');
  }

  const validPlatforms = ['doordash', 'ubereats'];
  if (!validPlatforms.includes(platform)) {
    throw new BadRequestError(`Invalid platform. Must be one of: ${validPlatforms.join(', ')}`);
  }

  const sessionInfo = sessionService.getSessionInfo(restaurantId, platform);

  if (!sessionInfo) {
    return res.json({
      success: true,
      data: {
        hasSession: false,
        message: 'No session found. Please initialize session first.'
      }
    });
  }

  res.json({
    success: true,
    data: {
      hasSession: true,
      isValid: sessionInfo.isValid,
      createdAt: sessionInfo.createdAt,
      lastUsedAt: sessionInfo.lastUsedAt,
      ageInDays: Math.floor((Date.now() - sessionInfo.createdAt.getTime()) / (1000 * 60 * 60 * 24)),
      message: sessionInfo.isValid
        ? 'Session is active and ready to use'
        : 'Session expired. Please re-initialize.'
    }
  });
}));

/**
 * POST /api/delivery-platforms-sessions/test/:platform
 * Test if session is still valid by trying to access platform
 */
router.post('/test/:platform', asyncHandler(async (req: Request, res: Response) => {
  const restaurantId = req.user?.restaurantId;
  const platform = req.params.platform as 'doordash' | 'ubereats';

  if (!restaurantId) {
    throw new UnauthorizedError('Restaurant ID required');
  }

  const validPlatforms = ['doordash', 'ubereats'];
  if (!validPlatforms.includes(platform)) {
    throw new BadRequestError(`Invalid platform. Must be one of: ${validPlatforms.join(', ')}`);
  }

  logger.info(`Testing session for restaurant ${restaurantId} - ${platform}`);

  const result = await sessionService.testSession(restaurantId, platform);

  res.json({
    success: true,
    data: {
      valid: result.valid,
      message: result.message
    }
  });
}));

/**
 * DELETE /api/delivery-platforms-sessions/:platform
 * Delete saved session
 */
router.delete('/:platform', asyncHandler(async (req: Request, res: Response) => {
  const restaurantId = req.user?.restaurantId;
  const platform = req.params.platform;

  if (!restaurantId) {
    throw new UnauthorizedError('Restaurant ID required');
  }

  if (!sessionService.sessionExists(restaurantId, platform)) {
    return res.json({
      success: true,
      message: 'No session to delete'
    });
  }

  sessionService.deleteSession(restaurantId, platform);

  res.json({
    success: true,
    message: 'Session deleted successfully'
  });
}));

/**
 * GET /api/delivery-platforms-sessions/list
 * List all sessions for the restaurant
 */
router.get('/list', asyncHandler(async (req: Request, res: Response) => {
  const restaurantId = req.user?.restaurantId;

  if (!restaurantId) {
    throw new UnauthorizedError('Restaurant ID required');
  }

  const allSessions = sessionService.listSessions();

  // Filter to only this restaurant's sessions
  const restaurantSessions = allSessions.filter(s => s.restaurantId === restaurantId);

  res.json({
    success: true,
    data: restaurantSessions.map(session => ({
      platform: session.platform,
      createdAt: session.createdAt,
      lastUsedAt: session.lastUsedAt,
      isValid: session.isValid,
      ageInDays: Math.floor((Date.now() - session.createdAt.getTime()) / (1000 * 60 * 60 * 24))
    }))
  });
}));

/**
 * POST /api/delivery-platforms-sessions/cleanup
 * Clean up expired sessions (admin only)
 */
router.post('/cleanup', asyncHandler(async (req: Request, res: Response) => {
  // TODO: Add admin check here
  // if (req.user?.role !== 'admin') throw new UnauthorizedError('Admin only');

  const cleaned = sessionService.cleanupExpiredSessions();

  res.json({
    success: true,
    message: `Cleaned up ${cleaned} expired sessions`
  });
}));

/**
 * GET /api/delivery-platforms-sessions/guide
 * Get quick start guide for session management
 */
router.get('/guide', asyncHandler(async (req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      title: 'Session Management Quick Start',
      steps: [
        {
          step: 1,
          title: 'Initialize Session',
          description: 'Open a browser window and login manually',
          endpoint: 'POST /api/delivery-platforms-sessions/init',
          body: {
            platform: 'doordash',
            username: 'your-email@restaurant.com',
            password: 'your-password'
          }
        },
        {
          step: 2,
          title: 'Check Session Status',
          description: 'Verify session was saved',
          endpoint: 'GET /api/delivery-platforms-sessions/status/:platform'
        },
        {
          step: 3,
          title: 'Run Automated Sync',
          description: 'Sync will automatically reuse the session',
          endpoint: 'POST /api/delivery-platforms/sync/:platform',
          note: 'No login required - uses saved session!'
        },
        {
          step: 4,
          title: 'Monitor Sessions',
          description: 'Check all your saved sessions',
          endpoint: 'GET /api/delivery-platforms-sessions/list'
        }
      ],
      benefits: [
        'No repeated logins (less suspicious)',
        'Faster syncing (skip login step)',
        'One captcha solve (manual first time)',
        'Separate sessions per restaurant',
        'Sessions last 30 days'
      ],
      tips: [
        'Initialize session with HEADLESS=false to see browser',
        'Session expires after 30 days - re-initialize when needed',
        'Each restaurant has separate sessions',
        'Test session validity before important syncs',
        'Delete and re-init if getting auth errors'
      ]
    }
  });
}));

export default router;
