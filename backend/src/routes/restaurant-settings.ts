import { Router, Request, Response } from 'express';
import { DatabaseService } from '../services/DatabaseService';
import { requireAuth } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

const router = Router();

/**
 * Get restaurant Vapi settings
 */
router.get('/:restaurantId/vapi', requireAuth, asyncHandler(async (req: Request, res: Response) => {
  const { restaurantId } = req.params;
  const db = DatabaseService.getInstance().getDatabase();

  // Check user has access to this restaurant
  if (req.user?.restaurantId !== restaurantId && req.user?.role !== 'platform-admin') {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  const restaurant = await db.get(
    'SELECT id, name, settings FROM restaurants WHERE id = ?',
    [restaurantId]
  );

  if (!restaurant) {
    return res.status(404).json({ error: 'Restaurant not found' });
  }

  const settings = JSON.parse(restaurant.settings || '{}');
  const vapiSettings = settings.vapi || {
    enabled: false,
    apiKey: '',
    webhookSecret: '',
    assistantId: '',
    phoneNumberId: '',
    phoneNumber: ''
  };

  // Don't send sensitive keys to frontend (only show if they exist)
  res.json({
    enabled: vapiSettings.enabled || false,
    hasApiKey: !!vapiSettings.apiKey,
    hasWebhookSecret: !!vapiSettings.webhookSecret,
    assistantId: vapiSettings.assistantId || '',
    phoneNumberId: vapiSettings.phoneNumberId || '',
    phoneNumber: vapiSettings.phoneNumber || '',
    systemPrompt: vapiSettings.systemPrompt || ''
  });
}));

/**
 * Update restaurant Vapi settings
 */
router.put('/:restaurantId/vapi', requireAuth, asyncHandler(async (req: Request, res: Response) => {
  const { restaurantId } = req.params;
  const db = DatabaseService.getInstance().getDatabase();

  // Check user has access to this restaurant
  if (req.user?.restaurantId !== restaurantId && req.user?.role !== 'platform-admin') {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  const restaurant = await db.get(
    'SELECT id, name, settings FROM restaurants WHERE id = ?',
    [restaurantId]
  );

  if (!restaurant) {
    return res.status(404).json({ error: 'Restaurant not found' });
  }

  const currentSettings = JSON.parse(restaurant.settings || '{}');
  const currentVapi = currentSettings.vapi || {};

  // Update Vapi settings
  const updatedVapi = {
    enabled: req.body.enabled ?? currentVapi.enabled,
    // Only update keys if provided (don't overwrite with empty strings)
    apiKey: req.body.apiKey || currentVapi.apiKey,
    webhookSecret: req.body.webhookSecret || currentVapi.webhookSecret,
    assistantId: req.body.assistantId ?? currentVapi.assistantId,
    phoneNumberId: req.body.phoneNumberId ?? currentVapi.phoneNumberId,
    phoneNumber: req.body.phoneNumber ?? currentVapi.phoneNumber,
    systemPrompt: req.body.systemPrompt ?? currentVapi.systemPrompt
  };

  currentSettings.vapi = updatedVapi;

  await db.run(
    'UPDATE restaurants SET settings = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [JSON.stringify(currentSettings), restaurantId]
  );

  logger.info('Vapi settings updated', { restaurantId, userId: req.user?.id });

  res.json({ 
    success: true, 
    message: 'Vapi settings updated successfully',
    settings: {
      enabled: updatedVapi.enabled,
      hasApiKey: !!updatedVapi.apiKey,
      hasWebhookSecret: !!updatedVapi.webhookSecret,
      assistantId: updatedVapi.assistantId,
      phoneNumberId: updatedVapi.phoneNumberId,
      phoneNumber: updatedVapi.phoneNumber
    }
  });
}));

/**
 * Test restaurant Vapi connection
 */
router.post('/:restaurantId/vapi/test', requireAuth, asyncHandler(async (req: Request, res: Response) => {
  const { restaurantId } = req.params;
  const db = DatabaseService.getInstance().getDatabase();

  // Check user has access to this restaurant
  if (req.user?.restaurantId !== restaurantId && req.user?.role !== 'platform-admin') {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  const restaurant = await db.get(
    'SELECT id, name, settings FROM restaurants WHERE id = ?',
    [restaurantId]
  );

  if (!restaurant) {
    return res.status(404).json({ error: 'Restaurant not found' });
  }

  const settings = JSON.parse(restaurant.settings || '{}');
  const vapiSettings = settings.vapi || {};

  if (!vapiSettings.enabled) {
    return res.status(400).json({ error: 'Vapi is not enabled for this restaurant' });
  }

  if (!vapiSettings.apiKey || !vapiSettings.phoneNumberId) {
    return res.status(400).json({ error: 'Vapi API key and phone number ID are required' });
  }

  // Test the Vapi API connection
  try {
    const vapiResponse = await fetch('https://api.vapi.ai/phone-number/' + vapiSettings.phoneNumberId, {
      headers: {
        'Authorization': `Bearer ${vapiSettings.apiKey}`
      }
    });

    if (!vapiResponse.ok) {
      return res.status(400).json({ 
        error: 'Failed to connect to Vapi',
        details: await vapiResponse.text()
      });
    }

    const phoneData = await vapiResponse.json() as any;
    
    res.json({
      success: true,
      message: 'Successfully connected to Vapi',
      phoneNumber: phoneData.number || vapiSettings.phoneNumber,
      assistantId: phoneData.assistantId
    });
  } catch (error) {
    logger.error('Vapi test connection failed', { restaurantId, error });
    res.status(500).json({ 
      error: 'Failed to test Vapi connection',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}));

/**
 * Get webhook URL for restaurant
 */
router.get('/:restaurantId/vapi/webhook-url', requireAuth, asyncHandler(async (req: Request, res: Response) => {
  const { restaurantId } = req.params;

  // Check user has access to this restaurant
  if (req.user?.restaurantId !== restaurantId && req.user?.role !== 'platform-admin') {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  const baseUrl = process.env.BASE_URL || 'http://localhost:3002';
  const webhookUrl = `${baseUrl}/api/vapi/webhook`;

  res.json({
    webhookUrl,
    assistantConfigUrl: `${baseUrl}/api/vapi/assistant-config`,
    instructions: [
      '1. Copy the webhook URL above',
      '2. Go to your Vapi dashboard',
      '3. Edit your assistant settings',
      '4. Paste the webhook URL in the "Server URL" field',
      '5. Save and test by calling your Vapi phone number'
    ]
  });
}));

export default router;
