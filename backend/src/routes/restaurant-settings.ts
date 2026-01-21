import { Router, Request, Response } from 'express';
import { DatabaseService } from '../services/DatabaseService';
import { requireAuth } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

const router = Router();

function safeJsonParse<T>(value: any, fallback: T): T {
  if (value == null) return fallback;
  if (typeof value !== 'string') return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function slugify(input: string) {
  const base = String(input || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
  return base || 'restaurant';
}

function defaultReceiptSettings() {
  return {
    paperSize: '80mm' as '80mm' | '58mm',
    headerTitle: '', // if empty, frontend can fall back to restaurant name
    headerSubtitle: 'Online Order',
    showLogo: true,
    showOrderId: true,
    showPlacedAt: true,
    showCustomerName: true,
    showCustomerPhone: true,
    showChannel: true,
    footerText: 'Thank you!',
    autoPrint: false,

    // Printing destination
    // - browser: uses OS print dialog (AirPrint / system printers)
    // - agent: uses a local LAN print agent (recommended for TCP/9100 printers)
    // - bluetooth: uses Web Bluetooth (Android/Chrome only; not supported on iOS Safari)
    printMode: 'browser' as 'browser' | 'agent' | 'bluetooth',
    agentUrl: 'http://localhost:8787',
    agentPrinter: null as null | { name?: string; host: string; port?: number; type?: string }
  };
}

function defaultMenuSettings() {
  return {
    heading: '',
    subheading: '',
    showLogo: true
  };
}

/**
 * GET /api/restaurants/:restaurantId/slug
 * Get public ordering slug for a restaurant
 */
router.get('/:restaurantId/slug', requireAuth, asyncHandler(async (req: Request, res: Response) => {
  const { restaurantId } = req.params;
  const db = DatabaseService.getInstance().getDatabase();

  if (req.user?.restaurantId !== restaurantId && req.user?.role !== 'platform-admin') {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  const restaurant = await db.get('SELECT id, slug FROM restaurants WHERE id = ?', [restaurantId]);
  if (!restaurant) {
    return res.status(404).json({ error: 'Restaurant not found' });
  }

  res.json({
    success: true,
    data: {
      slug: restaurant.slug
    }
  });
}));

/**
 * PUT /api/restaurants/:restaurantId/slug
 * Update public ordering slug
 */
router.put('/:restaurantId/slug', requireAuth, asyncHandler(async (req: Request, res: Response) => {
  const { restaurantId } = req.params;
  const { slug } = req.body ?? {};
  const db = DatabaseService.getInstance().getDatabase();

  if (req.user?.restaurantId !== restaurantId && req.user?.role !== 'platform-admin') {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  const restaurant = await db.get('SELECT id, slug FROM restaurants WHERE id = ?', [restaurantId]);
  if (!restaurant) {
    return res.status(404).json({ error: 'Restaurant not found' });
  }

  if (!slug || !String(slug).trim()) {
    return res.status(400).json({ error: 'Slug is required' });
  }

  const nextSlug = slugify(String(slug)).slice(0, 64);
  const existing = await db.get('SELECT id FROM restaurants WHERE slug = ? AND id <> ? LIMIT 1', [nextSlug, restaurantId]);
  if (existing?.id) {
    return res.status(409).json({ error: 'That public slug is already taken. Please choose another.' });
  }

  if (nextSlug !== restaurant.slug) {
    await db.run(
      'UPDATE restaurants SET slug = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [nextSlug, restaurantId]
    );
  }

  await DatabaseService.getInstance().logAudit(
    restaurantId,
    req.user?.id || 'system',
    'update_restaurant_slug',
    'restaurant',
    restaurantId,
    { slug: nextSlug }
  );

  res.json({
    success: true,
    data: {
      slug: nextSlug
    }
  });
}));

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

  const settings = safeJsonParse<Record<string, any>>(restaurant.settings, {});
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
 * GET /api/restaurants/:restaurantId/receipt
 * Get receipt / ticket printing settings (non-sensitive)
 */
router.get('/:restaurantId/receipt', requireAuth, asyncHandler(async (req: Request, res: Response) => {
  const { restaurantId } = req.params;
  const db = DatabaseService.getInstance().getDatabase();

  if (req.user?.restaurantId !== restaurantId && req.user?.role !== 'platform-admin') {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  const restaurant = await db.get(
    'SELECT id, name, settings, logo_url, address, phone FROM restaurants WHERE id = ?',
    [restaurantId]
  );

  if (!restaurant) {
    return res.status(404).json({ error: 'Restaurant not found' });
  }

  const settings = safeJsonParse<Record<string, any>>(restaurant.settings, {});
  const receipt = { ...defaultReceiptSettings(), ...(settings.receipt ?? {}) };

  res.json({
    success: true,
    data: {
      restaurant: {
        id: restaurant.id,
        name: restaurant.name,
        logoUrl: restaurant.logo_url ?? null,
        phone: restaurant.phone ?? null,
        address: safeJsonParse<any>(restaurant.address, null)
      },
      receipt
    }
  });
}));

/**
 * GET /api/restaurants/:restaurantId/alert-settings
 * Get alert call settings
 */
router.get('/:restaurantId/alert-settings', requireAuth, asyncHandler(async (req: Request, res: Response) => {
  const { restaurantId } = req.params;
  const db = DatabaseService.getInstance().getDatabase();

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

  const settings = safeJsonParse<Record<string, any>>(restaurant.settings, {});
  const alertSettings = settings.alerts || {
    enabled: false,
    supervisorPhone: '',
    failureThresholdMinutes: 5,
    retryAttempts: 3,
    enabledForOrderFailures: true,
    enabledForSystemDown: true
  };

  res.json({
    success: true,
    data: alertSettings
  });
}));

/**
 * PUT /api/restaurants/:restaurantId/alert-settings  
 * Update alert call settings
 */
router.put('/:restaurantId/alert-settings', requireAuth, asyncHandler(async (req: Request, res: Response) => {
  const { restaurantId } = req.params;
  const db = DatabaseService.getInstance().getDatabase();

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

  const currentSettings = safeJsonParse<Record<string, any>>(restaurant.settings, {});
  const updatedAlerts = {
    enabled: req.body.enabled ?? false,
    supervisorPhone: req.body.supervisorPhone ?? '',
    failureThresholdMinutes: req.body.failureThresholdMinutes ?? 5,
    retryAttempts: req.body.retryAttempts ?? 3,
    enabledForOrderFailures: req.body.enabledForOrderFailures ?? true,
    enabledForSystemDown: req.body.enabledForSystemDown ?? true
  };

  currentSettings.alerts = updatedAlerts;

  await db.run(
    'UPDATE restaurants SET settings = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [JSON.stringify(currentSettings), restaurantId]
  );

  res.json({
    success: true,
    data: updatedAlerts
  });
}));

/**
 * POST /api/restaurants/:restaurantId/test-alert-call
 * Test the alert call functionality
 */
router.post('/:restaurantId/test-alert-call', requireAuth, asyncHandler(async (req: Request, res: Response) => {
  const { restaurantId } = req.params;
  const db = DatabaseService.getInstance().getDatabase();

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

  const settings = safeJsonParse<Record<string, any>>(restaurant.settings, {});
  const alertSettings = settings.alerts;

  if (!alertSettings?.enabled || !alertSettings?.supervisorPhone) {
    return res.status(400).json({ 
      error: 'Alert calls not configured. Please set up supervisor phone number first.' 
    });
  }

  try {
    // Import AlertService dynamically to avoid startup dependencies
    const { AlertService } = await import('../services/AlertService');
    const alertService = new AlertService();
    
    await alertService.sendAlertCall(
      alertSettings.supervisorPhone,
      'This is a test alert call from Servio. Your restaurant alert system is working properly.',
      { type: 'test', restaurantId }
    );

    res.json({
      success: true,
      message: 'Test alert call sent successfully'
    });
  } catch (error) {
    logger.error('Alert call test failed', { error, restaurantId });
    res.status(500).json({
      error: 'Failed to send test alert call',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}));

/**
 * PUT /api/restaurants/:restaurantId/receipt
 * Update receipt / ticket printing settings
 */
router.put('/:restaurantId/receipt', requireAuth, asyncHandler(async (req: Request, res: Response) => {
  const { restaurantId } = req.params;
  const db = DatabaseService.getInstance().getDatabase();

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

  const currentSettings = safeJsonParse<Record<string, any>>(restaurant.settings, {});
  const currentReceipt = { ...defaultReceiptSettings(), ...(currentSettings.receipt ?? {}) };

  const nextReceipt = {
    ...currentReceipt,
    paperSize: req.body.paperSize ?? currentReceipt.paperSize,
    headerTitle: req.body.headerTitle ?? currentReceipt.headerTitle,
    headerSubtitle: req.body.headerSubtitle ?? currentReceipt.headerSubtitle,
    showLogo: req.body.showLogo ?? currentReceipt.showLogo,
    showOrderId: req.body.showOrderId ?? currentReceipt.showOrderId,
    showPlacedAt: req.body.showPlacedAt ?? currentReceipt.showPlacedAt,
    showCustomerName: req.body.showCustomerName ?? currentReceipt.showCustomerName,
    showCustomerPhone: req.body.showCustomerPhone ?? currentReceipt.showCustomerPhone,
    showChannel: req.body.showChannel ?? currentReceipt.showChannel,
    footerText: req.body.footerText ?? currentReceipt.footerText,
    autoPrint: req.body.autoPrint ?? currentReceipt.autoPrint,
    printMode: req.body.printMode ?? currentReceipt.printMode,
    agentUrl: req.body.agentUrl ?? currentReceipt.agentUrl,
    agentPrinter: req.body.agentPrinter ?? currentReceipt.agentPrinter
  };

  currentSettings.receipt = nextReceipt;

  await db.run(
    'UPDATE restaurants SET settings = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [JSON.stringify(currentSettings), restaurantId]
  );

  logger.info('Receipt settings updated', { restaurantId, userId: req.user?.id });

  res.json({
    success: true,
    data: {
      receipt: nextReceipt
    }
  });
}));

/**
 * GET /api/restaurants/:restaurantId/menu-settings
 * Get public menu page settings (non-sensitive)
 */
router.get('/:restaurantId/menu-settings', requireAuth, asyncHandler(async (req: Request, res: Response) => {
  const { restaurantId } = req.params;
  const db = DatabaseService.getInstance().getDatabase();

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

  const settings = safeJsonParse<Record<string, any>>(restaurant.settings, {});
  const menu = { ...defaultMenuSettings(), ...(settings.menu ?? {}) };

  res.json({
    success: true,
    data: menu
  });
}));

/**
 * PUT /api/restaurants/:restaurantId/menu-settings
 * Update public menu page settings
 */
router.put('/:restaurantId/menu-settings', requireAuth, asyncHandler(async (req: Request, res: Response) => {
  const { restaurantId } = req.params;
  const db = DatabaseService.getInstance().getDatabase();

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

  const currentSettings = safeJsonParse<Record<string, any>>(restaurant.settings, {});
  const currentMenu = { ...defaultMenuSettings(), ...(currentSettings.menu ?? {}) };

  const nextMenu = {
    ...currentMenu,
    heading: req.body.heading ?? currentMenu.heading,
    subheading: req.body.subheading ?? currentMenu.subheading,
    showLogo: req.body.showLogo ?? currentMenu.showLogo
  };

  currentSettings.menu = nextMenu;

  await db.run(
    'UPDATE restaurants SET settings = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [JSON.stringify(currentSettings), restaurantId]
  );

  logger.info('Menu settings updated', { restaurantId, userId: req.user?.id });

  res.json({
    success: true,
    data: nextMenu
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

  const currentSettings = safeJsonParse<Record<string, any>>(restaurant.settings, {});
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

  const settings = safeJsonParse<Record<string, any>>(restaurant.settings, {});
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
