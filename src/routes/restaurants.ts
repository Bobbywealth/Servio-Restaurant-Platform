import { Router, Request, Response } from 'express';
import { DatabaseService } from '../services/DatabaseService';
import { asyncHandler } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

const router = Router();

type VapiSettings = {
  enabled?: boolean;
  apiKey?: string;
  webhookSecret?: string;
  assistantId?: string;
  phoneNumberId?: string;
  phoneNumber?: string;
};

const ADMIN_ROLES = new Set(['admin', 'platform-admin']);

const canAccessRestaurant = (req: Request, restaurantId: string) => {
  const user = req.user;
  if (!user) return false;
  if (user.restaurantId === restaurantId) return true;
  return ADMIN_ROLES.has(user.role);
};

const parseSettings = (raw: any) => {
  if (!raw) return {};
  if (typeof raw === 'object') return raw;
  if (typeof raw !== 'string') return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
};

const normalizeVapiSettings = (settings: any): Required<Pick<VapiSettings, 'enabled' | 'assistantId' | 'phoneNumberId' | 'phoneNumber'>> & {
  hasApiKey: boolean;
  hasWebhookSecret: boolean;
} => {
  const vapi = settings?.vapi ?? {};
  const apiKey = typeof vapi.apiKey === 'string' ? vapi.apiKey : '';
  const webhookSecret = typeof vapi.webhookSecret === 'string' ? vapi.webhookSecret : '';

  return {
    enabled: Boolean(vapi.enabled),
    assistantId: typeof vapi.assistantId === 'string' ? vapi.assistantId : '',
    phoneNumberId: typeof vapi.phoneNumberId === 'string' ? vapi.phoneNumberId : '',
    phoneNumber: typeof vapi.phoneNumber === 'string' ? vapi.phoneNumber : '',
    hasApiKey: Boolean(apiKey),
    hasWebhookSecret: Boolean(webhookSecret)
  };
};

/**
 * GET /api/restaurants/:id/vapi
 * Get per-restaurant Vapi settings
 */
router.get('/:id/vapi', asyncHandler(async (req: Request, res: Response) => {
  const restaurantId = req.params.id;
  if (!canAccessRestaurant(req, restaurantId)) {
    return res.status(403).json({
      success: false,
      error: { message: 'Not authorized to access this restaurant' }
    });
  }

  const db = DatabaseService.getInstance().getDatabase();
  const restaurant = await db.get('SELECT settings FROM restaurants WHERE id = ?', [restaurantId]);
  if (!restaurant) {
    return res.status(404).json({
      success: false,
      error: { message: 'Restaurant not found' }
    });
  }

  const settings = parseSettings(restaurant.settings);
  const vapiSettings = normalizeVapiSettings(settings);

  return res.json(vapiSettings);
}));

/**
 * PUT /api/restaurants/:id/vapi
 * Update per-restaurant Vapi settings
 */
router.put('/:id/vapi', asyncHandler(async (req: Request, res: Response) => {
  const restaurantId = req.params.id;
  if (!canAccessRestaurant(req, restaurantId)) {
    return res.status(403).json({
      success: false,
      error: { message: 'Not authorized to access this restaurant' }
    });
  }

  const db = DatabaseService.getInstance().getDatabase();
  const restaurant = await db.get('SELECT settings FROM restaurants WHERE id = ?', [restaurantId]);
  if (!restaurant) {
    return res.status(404).json({
      success: false,
      error: { message: 'Restaurant not found' }
    });
  }

  const settings = parseSettings(restaurant.settings);
  const existingVapi = typeof settings.vapi === 'object' && settings.vapi ? settings.vapi : {};

  const body = req.body as VapiSettings;
  const nextVapi: VapiSettings = {
    enabled: body.enabled ?? existingVapi.enabled ?? false,
    assistantId: body.assistantId ?? existingVapi.assistantId ?? '',
    phoneNumberId: body.phoneNumberId ?? existingVapi.phoneNumberId ?? '',
    phoneNumber: body.phoneNumber ?? existingVapi.phoneNumber ?? ''
  };

  const trimmedApiKey = typeof body.apiKey === 'string' ? body.apiKey.trim() : '';
  if (trimmedApiKey) {
    nextVapi.apiKey = trimmedApiKey;
  } else if (existingVapi.apiKey) {
    nextVapi.apiKey = existingVapi.apiKey;
  }

  const trimmedWebhookSecret = typeof body.webhookSecret === 'string' ? body.webhookSecret.trim() : '';
  if (trimmedWebhookSecret) {
    nextVapi.webhookSecret = trimmedWebhookSecret;
  } else if (existingVapi.webhookSecret) {
    nextVapi.webhookSecret = existingVapi.webhookSecret;
  }

  if (nextVapi.enabled && !nextVapi.apiKey) {
    return res.status(400).json({
      success: false,
      error: { message: 'Vapi API key is required to enable the phone system.' }
    });
  }

  settings.vapi = nextVapi;

  await db.run(
    'UPDATE restaurants SET settings = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [JSON.stringify(settings), restaurantId]
  );

  await DatabaseService.getInstance().logAudit(
    restaurantId,
    req.user?.id || 'system',
    'update_restaurant_vapi_settings',
    'restaurant',
    restaurantId,
    {
      enabled: nextVapi.enabled,
      assistantId: nextVapi.assistantId,
      phoneNumberId: nextVapi.phoneNumberId,
      phoneNumber: nextVapi.phoneNumber,
      hasApiKey: Boolean(nextVapi.apiKey),
      hasWebhookSecret: Boolean(nextVapi.webhookSecret)
    }
  );

  logger.info(`Restaurant Vapi settings updated for ${restaurantId}`);

  return res.json(normalizeVapiSettings(settings));
}));

/**
 * POST /api/restaurants/:id/vapi/test
 * Test Vapi configuration connectivity
 */
router.post('/:id/vapi/test', asyncHandler(async (req: Request, res: Response) => {
  const restaurantId = req.params.id;
  if (!canAccessRestaurant(req, restaurantId)) {
    return res.status(403).json({
      success: false,
      error: { message: 'Not authorized to access this restaurant' }
    });
  }

  const db = DatabaseService.getInstance().getDatabase();
  const restaurant = await db.get('SELECT settings FROM restaurants WHERE id = ?', [restaurantId]);
  if (!restaurant) {
    return res.status(404).json({
      success: false,
      error: { message: 'Restaurant not found' }
    });
  }

  const settings = parseSettings(restaurant.settings);
  const vapiSettings = normalizeVapiSettings(settings);

  if (!vapiSettings.hasApiKey) {
    return res.status(400).json({
      success: false,
      error: { message: 'Vapi API key is not configured for this restaurant.' }
    });
  }

  return res.json({
    success: true,
    phoneNumber: vapiSettings.phoneNumber || null,
    phoneNumberId: vapiSettings.phoneNumberId || null,
    assistantId: vapiSettings.assistantId || null,
    enabled: vapiSettings.enabled
  });
}));

export default router;
