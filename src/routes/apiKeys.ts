import { Router, Request, Response } from 'express';
import { ApiKeyService } from '../services/ApiKeyService';
import {
  asyncHandler,
  NotFoundError,
  ForbiddenError,
  ValidationError,
} from '../middleware/errorHandler';
import { requireAuth } from '../middleware/auth';
import { logger } from '../utils/logger';
import type { AuthUser } from '../types/auth';
import type {
  ApiKeyScope,
  CreateApiKeyRequest,
  UpdateApiKeyRequest,
  ApiKeyUsageQuery,
  WebhookEventType,
} from '../types/apiKey';

const router = Router();

// Extended AuthUser type with company-specific properties
type CompanyAuthUser = AuthUser & {
  companyId?: string;
  companyRole?: 'super_admin' | 'admin' | 'manager' | 'viewer';
};

const COMPANY_ADMIN_ROLES = new Set(['super_admin', 'admin']);

/**
 * Helper: Get company ID from request
 */
const getCompanyId = (req: Request): string | null => {
  const user = req.user as CompanyAuthUser | undefined;
  return user?.companyId || null;
};

/**
 * Helper: Check if user can manage API keys
 */
const canManageApiKeys = (req: Request): boolean => {
  const user = req.user as CompanyAuthUser | undefined;
  if (!user) return false;
  if (user.role === 'owner' || user.role === 'admin' || user.role === 'platform-admin') return true;
  if (COMPANY_ADMIN_ROLES.has(user.companyRole as string)) return true;
  return false;
};

/**
 * Helper: Validate API key scopes
 */
const validateScopes = (scopes: any[]): { valid: boolean; error?: string } => {
  const validScopes: ApiKeyScope[] = [
    'read:orders', 'write:orders',
    'read:menu', 'write:menu',
    'read:customers', 'write:customers',
    'read:inventory', 'write:inventory',
    'read:staff', 'write:staff',
    'read:analytics',
    'admin:full',
    'webhooks',
    'read:reservations', 'write:reservations',
    'read:payments', 'write:payments',
  ];

  for (const scope of scopes) {
    if (!validScopes.includes(scope)) {
      return { valid: false, error: `Invalid scope: ${scope}` };
    }
  }

  return { valid: true };
};

// ============================================================================
// API KEY ROUTES
// ============================================================================

/**
 * GET /api/api-keys
 * List all API keys for the current company/restaurant
 */
router.get('/', requireAuth, asyncHandler(async (req: Request, res: Response) => {
  if (!canManageApiKeys(req)) {
    throw new ForbiddenError('You do not have permission to view API keys');
  }

  const companyId = getCompanyId(req);
  const user = req.user as AuthUser;

  const keys = await ApiKeyService.listApiKeys({
    companyId: companyId || undefined,
    restaurantId: companyId ? undefined : user.restaurantId,
    includeInactive: req.query.includeInactive === 'true',
  });

  // Mask sensitive data
  const maskedKeys = keys.map(key => ({
    ...key,
    keyHash: undefined, // Never expose the hash
  }));

  return res.json({
    success: true,
    data: maskedKeys,
  });
}));

/**
 * GET /api/api-keys/:id
 * Get a specific API key by ID
 */
router.get('/:id', requireAuth, asyncHandler(async (req: Request, res: Response) => {
  if (!canManageApiKeys(req)) {
    throw new ForbiddenError('You do not have permission to view API keys');
  }

  const id = req.params.id as string;
  const key = await ApiKeyService.getApiKey(id);

  if (!key) {
    throw new NotFoundError('API key not found');
  }

  // Verify access
  const companyId = getCompanyId(req);
  const user = req.user as AuthUser;

  if (key.companyId && key.companyId !== companyId) {
    throw new ForbiddenError('You do not have access to this API key');
  }
  if (key.restaurantId && key.restaurantId !== user.restaurantId && !companyId) {
    throw new ForbiddenError('You do not have access to this API key');
  }

  return res.json({
    success: true,
    data: {
      ...key,
      keyHash: undefined, // Never expose the hash
    },
  });
}));

/**
 * POST /api/api-keys
 * Create a new API key
 */
router.post('/', requireAuth, asyncHandler(async (req: Request, res: Response) => {
  if (!canManageApiKeys(req)) {
    throw new ForbiddenError('You do not have permission to create API keys');
  }

  const { name, description, scopes, rateLimit, expiresAt, restaurantId: targetRestaurantId } = req.body;

  // Validate required fields
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    throw new ValidationError('API key name is required');
  }

  if (!scopes || !Array.isArray(scopes) || scopes.length === 0) {
    throw new ValidationError('At least one scope is required');
  }

  // Validate scopes
  const scopeValidation = validateScopes(scopes);
  if (!scopeValidation.valid) {
    throw new ValidationError(scopeValidation.error || 'Invalid scopes');
  }

  const companyId = getCompanyId(req);
  const user = req.user as AuthUser;

  // Determine restaurant scope
  let finalRestaurantId: string | undefined;
  if (targetRestaurantId) {
    // If targeting a specific restaurant, verify access
    if (!companyId) {
      // Single restaurant user can only create keys for their restaurant
      if (targetRestaurantId !== user.restaurantId) {
        throw new ForbiddenError('You can only create API keys for your own restaurant');
      }
    }
    finalRestaurantId = targetRestaurantId;
  } else if (!companyId && user.restaurantId) {
    // If no company and no target specified, use user's restaurant
    finalRestaurantId = user.restaurantId;
  }

  const createRequest: CreateApiKeyRequest = {
    name: name.trim(),
    description: description?.trim(),
    companyId: companyId || undefined,
    restaurantId: finalRestaurantId,
    scopes,
    rateLimit: rateLimit ? parseInt(rateLimit, 10) : undefined,
    expiresAt: expiresAt ? new Date(expiresAt) : undefined,
  };

  // Validate expiration date
  if (createRequest.expiresAt && createRequest.expiresAt <= new Date()) {
    throw new ValidationError('Expiration date must be in the future');
  }

  const result = await ApiKeyService.createApiKey(createRequest, user.id);

  logger.info(`API key created: ${result.keyPrefix} by user ${user.id}`);

  return res.status(201).json({
    success: true,
    data: result,
    message: 'API key created successfully. Save the key securely - it will not be shown again.',
  });
}));

/**
 * PUT /api/api-keys/:id
 * Update an existing API key
 */
router.put('/:id', requireAuth, asyncHandler(async (req: Request, res: Response) => {
  if (!canManageApiKeys(req)) {
    throw new ForbiddenError('You do not have permission to update API keys');
  }

  const id = req.params.id as string;
  const existingKey = await ApiKeyService.getApiKey(id);

  if (!existingKey) {
    throw new NotFoundError('API key not found');
  }

  // Verify access
  const companyId = getCompanyId(req);
  const user = req.user as AuthUser;

  if (existingKey.companyId && existingKey.companyId !== companyId) {
    throw new ForbiddenError('You do not have access to this API key');
  }
  if (existingKey.restaurantId && existingKey.restaurantId !== user.restaurantId && !companyId) {
    throw new ForbiddenError('You do not have access to this API key');
  }

  const { name, description, scopes, rateLimit, isActive, expiresAt } = req.body;

  // Validate scopes if provided
  if (scopes !== undefined) {
    if (!Array.isArray(scopes) || scopes.length === 0) {
      throw new ValidationError('At least one scope is required');
    }
    const scopeValidation = validateScopes(scopes);
    if (!scopeValidation.valid) {
      throw new ValidationError(scopeValidation.error || 'Invalid scopes');
    }
  }

  // Validate expiration date if provided
  if (expiresAt !== undefined && expiresAt !== null) {
    const expDate = new Date(expiresAt);
    if (expDate <= new Date()) {
      throw new ValidationError('Expiration date must be in the future');
    }
  }

  const updateRequest: UpdateApiKeyRequest = {
    name: name?.trim(),
    description: description?.trim(),
    scopes,
    rateLimit: rateLimit ? parseInt(rateLimit, 10) : undefined,
    isActive,
    expiresAt: expiresAt === null ? undefined : (expiresAt ? new Date(expiresAt) : undefined),
  };

  const updatedKey = await ApiKeyService.updateApiKey(id, updateRequest);

  logger.info(`API key updated: ${id} by user ${user.id}`);

  return res.json({
    success: true,
    data: {
      ...updatedKey,
      keyHash: undefined,
    },
    message: 'API key updated successfully',
  });
}));

/**
 * DELETE /api/api-keys/:id
 * Delete (revoke) an API key
 */
router.delete('/:id', requireAuth, asyncHandler(async (req: Request, res: Response) => {
  if (!canManageApiKeys(req)) {
    throw new ForbiddenError('You do not have permission to delete API keys');
  }

  const id = req.params.id as string;
  const existingKey = await ApiKeyService.getApiKey(id);

  if (!existingKey) {
    throw new NotFoundError('API key not found');
  }

  // Verify access
  const companyId = getCompanyId(req);
  const user = req.user as AuthUser;

  if (existingKey.companyId && existingKey.companyId !== companyId) {
    throw new ForbiddenError('You do not have access to this API key');
  }
  if (existingKey.restaurantId && existingKey.restaurantId !== user.restaurantId && !companyId) {
    throw new ForbiddenError('You do not have access to this API key');
  }

  await ApiKeyService.deleteApiKey(id);

  logger.info(`API key deleted: ${id} by user ${user.id}`);

  return res.json({
    success: true,
    message: 'API key revoked successfully',
  });
}));

/**
 * GET /api/api-keys/:id/usage
 * Get usage history for an API key
 */
router.get('/:id/usage', requireAuth, asyncHandler(async (req: Request, res: Response) => {
  if (!canManageApiKeys(req)) {
    throw new ForbiddenError('You do not have permission to view API key usage');
  }

  const id = req.params.id as string;
  const existingKey = await ApiKeyService.getApiKey(id);

  if (!existingKey) {
    throw new NotFoundError('API key not found');
  }

  // Verify access
  const companyId = getCompanyId(req);
  const user = req.user as AuthUser;

  if (existingKey.companyId && existingKey.companyId !== companyId) {
    throw new ForbiddenError('You do not have access to this API key');
  }
  if (existingKey.restaurantId && existingKey.restaurantId !== user.restaurantId && !companyId) {
    throw new ForbiddenError('You do not have access to this API key');
  }

  const { startDate, endDate, endpoint, method, statusCode, limit, offset } = req.query;

  const query: ApiKeyUsageQuery = {
    apiKeyId: id,
    startDate: startDate ? new Date(startDate as string) : undefined,
    endDate: endDate ? new Date(endDate as string) : undefined,
    endpoint: endpoint as string,
    method: method as string,
    statusCode: statusCode ? parseInt(statusCode as string, 10) : undefined,
    limit: limit ? parseInt(limit as string, 10) : 100,
    offset: offset ? parseInt(offset as string, 10) : 0,
  };

  const usage = await ApiKeyService.getUsageHistory(query);

  return res.json({
    success: true,
    data: usage,
  });
}));

/**
 * GET /api/api-keys/:id/stats
 * Get statistics for an API key
 */
router.get('/:id/stats', requireAuth, asyncHandler(async (req: Request, res: Response) => {
  if (!canManageApiKeys(req)) {
    throw new ForbiddenError('You do not have permission to view API key statistics');
  }

  const id = req.params.id as string;
  const existingKey = await ApiKeyService.getApiKey(id);

  if (!existingKey) {
    throw new NotFoundError('API key not found');
  }

  // Verify access
  const companyId = getCompanyId(req);
  const user = req.user as AuthUser;

  if (existingKey.companyId && existingKey.companyId !== companyId) {
    throw new ForbiddenError('You do not have access to this API key');
  }
  if (existingKey.restaurantId && existingKey.restaurantId !== user.restaurantId && !companyId) {
    throw new ForbiddenError('You do not have access to this API key');
  }

  const days = req.query.days ? parseInt(req.query.days as string, 10) : 30;
  const stats = await ApiKeyService.getStats(id, Math.min(days, 365)); // Max 1 year

  return res.json({
    success: true,
    data: stats,
  });
}));

// ============================================================================
// WEBHOOK ROUTES
// ============================================================================

/**
 * GET /api/api-keys/:id/webhooks
 * List webhooks for an API key
 */
router.get('/:id/webhooks', requireAuth, asyncHandler(async (req: Request, res: Response) => {
  if (!canManageApiKeys(req)) {
    throw new ForbiddenError('You do not have permission to view webhooks');
  }

  const id = req.params.id as string;
  const existingKey = await ApiKeyService.getApiKey(id);

  if (!existingKey) {
    throw new NotFoundError('API key not found');
  }

  // Verify access
  const companyId = getCompanyId(req);
  const user = req.user as AuthUser;

  if (existingKey.companyId && existingKey.companyId !== companyId) {
    throw new ForbiddenError('You do not have access to this API key');
  }
  if (existingKey.restaurantId && existingKey.restaurantId !== user.restaurantId && !companyId) {
    throw new ForbiddenError('You do not have access to this API key');
  }

  // Check if API key has webhooks scope
  if (!existingKey.scopes.includes('webhooks') && !existingKey.scopes.includes('admin:full')) {
    throw new ForbiddenError('API key does not have webhooks scope');
  }

  const webhooks = await ApiKeyService.listWebhooks(id);

  return res.json({
    success: true,
    data: webhooks.map(wh => ({
      ...wh,
      secret: wh.secret ? '••••••••' : undefined, // Mask the secret
    })),
  });
}));

/**
 * POST /api/api-keys/:id/webhooks
 * Create a webhook for an API key
 */
router.post('/:id/webhooks', requireAuth, asyncHandler(async (req: Request, res: Response) => {
  if (!canManageApiKeys(req)) {
    throw new ForbiddenError('You do not have permission to create webhooks');
  }

  const id = req.params.id as string;
  const existingKey = await ApiKeyService.getApiKey(id);

  if (!existingKey) {
    throw new NotFoundError('API key not found');
  }

  // Verify access
  const companyId = getCompanyId(req);
  const user = req.user as AuthUser;

  if (existingKey.companyId && existingKey.companyId !== companyId) {
    throw new ForbiddenError('You do not have access to this API key');
  }
  if (existingKey.restaurantId && existingKey.restaurantId !== user.restaurantId && !companyId) {
    throw new ForbiddenError('You do not have access to this API key');
  }

  // Check if API key has webhooks scope
  if (!existingKey.scopes.includes('webhooks') && !existingKey.scopes.includes('admin:full')) {
    throw new ForbiddenError('API key does not have webhooks scope');
  }

  const { name, url, secret, events } = req.body;

  // Validate required fields
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    throw new ValidationError('Webhook name is required');
  }

  if (!url || typeof url !== 'string') {
    throw new ValidationError('Webhook URL is required');
  }

  // Validate URL
  try {
    const parsedUrl = new URL(url);
    if (!parsedUrl.protocol.startsWith('http')) {
      throw new ValidationError('Webhook URL must use HTTP or HTTPS');
    }
  } catch {
    throw new ValidationError('Invalid webhook URL');
  }

  if (!events || !Array.isArray(events) || events.length === 0) {
    throw new ValidationError('At least one event type is required');
  }

  // Validate event types
  const validEvents: WebhookEventType[] = [
    'order.created', 'order.updated', 'order.completed', 'order.cancelled',
    'menu.updated', 'inventory.low_stock', 'customer.created',
    'payment.received', 'reservation.created', 'reservation.updated',
  ];

  for (const event of events) {
    if (!validEvents.includes(event)) {
      throw new ValidationError(`Invalid event type: ${event}`);
    }
  }

  const webhook = await ApiKeyService.createWebhook(id, {
    name: name.trim(),
    url,
    secret: secret?.trim(),
    events,
  });

  logger.info(`Webhook created: ${webhook.id} for API key ${id} by user ${user.id}`);

  return res.status(201).json({
    success: true,
    data: {
      ...webhook,
      secret: webhook.secret ? '••••••••' : undefined,
    },
    message: 'Webhook created successfully',
  });
}));

/**
 * PUT /api/api-keys/:apiKeyId/webhooks/:webhookId
 * Update a webhook
 */
router.put('/:apiKeyId/webhooks/:webhookId', requireAuth, asyncHandler(async (req: Request, res: Response) => {
  if (!canManageApiKeys(req)) {
    throw new ForbiddenError('You do not have permission to update webhooks');
  }

  const apiKeyId = req.params.apiKeyId as string;
  const webhookId = req.params.webhookId as string;
  const existingKey = await ApiKeyService.getApiKey(apiKeyId);

  if (!existingKey) {
    throw new NotFoundError('API key not found');
  }

  // Verify access
  const companyId = getCompanyId(req);
  const user = req.user as AuthUser;

  if (existingKey.companyId && existingKey.companyId !== companyId) {
    throw new ForbiddenError('You do not have access to this API key');
  }
  if (existingKey.restaurantId && existingKey.restaurantId !== user.restaurantId && !companyId) {
    throw new ForbiddenError('You do not have access to this API key');
  }

  const { name, url, secret, events, isActive } = req.body;

  // Validate URL if provided
  if (url) {
    try {
      const parsedUrl = new URL(url);
      if (!parsedUrl.protocol.startsWith('http')) {
        throw new ValidationError('Webhook URL must use HTTP or HTTPS');
      }
    } catch {
      throw new ValidationError('Invalid webhook URL');
    }
  }

  // Validate event types if provided
  if (events !== undefined) {
    if (!Array.isArray(events) || events.length === 0) {
      throw new ValidationError('At least one event type is required');
    }

    const validEvents: WebhookEventType[] = [
      'order.created', 'order.updated', 'order.completed', 'order.cancelled',
      'menu.updated', 'inventory.low_stock', 'customer.created',
      'payment.received', 'reservation.created', 'reservation.updated',
    ];

    for (const event of events) {
      if (!validEvents.includes(event)) {
        throw new ValidationError(`Invalid event type: ${event}`);
      }
    }
  }

  const webhook = await ApiKeyService.updateWebhook(webhookId, {
    name: name?.trim(),
    url,
    secret: secret?.trim(),
    events,
    isActive,
  });

  if (!webhook) {
    throw new NotFoundError('Webhook not found');
  }

  logger.info(`Webhook updated: ${webhookId} by user ${user.id}`);

  return res.json({
    success: true,
    data: {
      ...webhook,
      secret: webhook.secret ? '••••••••' : undefined,
    },
    message: 'Webhook updated successfully',
  });
}));

/**
 * DELETE /api/api-keys/:apiKeyId/webhooks/:webhookId
 * Delete a webhook
 */
router.delete('/:apiKeyId/webhooks/:webhookId', requireAuth, asyncHandler(async (req: Request, res: Response) => {
  if (!canManageApiKeys(req)) {
    throw new ForbiddenError('You do not have permission to delete webhooks');
  }

  const apiKeyId = req.params.apiKeyId as string;
  const webhookId = req.params.webhookId as string;
  const existingKey = await ApiKeyService.getApiKey(apiKeyId);

  if (!existingKey) {
    throw new NotFoundError('API key not found');
  }

  // Verify access
  const companyId = getCompanyId(req);
  const user = req.user as AuthUser;

  if (existingKey.companyId && existingKey.companyId !== companyId) {
    throw new ForbiddenError('You do not have access to this API key');
  }
  if (existingKey.restaurantId && existingKey.restaurantId !== user.restaurantId && !companyId) {
    throw new ForbiddenError('You do not have access to this API key');
  }

  const deleted = await ApiKeyService.deleteWebhook(webhookId);

  if (!deleted) {
    throw new NotFoundError('Webhook not found');
  }

  logger.info(`Webhook deleted: ${webhookId} by user ${user.id}`);

  return res.json({
    success: true,
    message: 'Webhook deleted successfully',
  });
}));

/**
 * GET /api/api-keys/scopes
 * Get available API key scopes
 */
router.get('/scopes/list', requireAuth, asyncHandler(async (_req: Request, res: Response) => {
  const scopeGroups = {
    orders: {
      label: 'Orders',
      scopes: [
        { value: 'read:orders', label: 'Read Orders', description: 'View order information' },
        { value: 'write:orders', label: 'Write Orders', description: 'Create and update orders' },
      ],
    },
    menu: {
      label: 'Menu',
      scopes: [
        { value: 'read:menu', label: 'Read Menu', description: 'View menu items and categories' },
        { value: 'write:menu', label: 'Write Menu', description: 'Create, update, and delete menu items' },
      ],
    },
    customers: {
      label: 'Customers',
      scopes: [
        { value: 'read:customers', label: 'Read Customers', description: 'View customer information' },
        { value: 'write:customers', label: 'Write Customers', description: 'Create and update customers' },
      ],
    },
    inventory: {
      label: 'Inventory',
      scopes: [
        { value: 'read:inventory', label: 'Read Inventory', description: 'View inventory levels' },
        { value: 'write:inventory', label: 'Write Inventory', description: 'Update inventory levels' },
      ],
    },
    staff: {
      label: 'Staff',
      scopes: [
        { value: 'read:staff', label: 'Read Staff', description: 'View staff information' },
        { value: 'write:staff', label: 'Write Staff', description: 'Manage staff records' },
      ],
    },
    analytics: {
      label: 'Analytics',
      scopes: [
        { value: 'read:analytics', label: 'Read Analytics', description: 'Access analytics and reports' },
      ],
    },
    reservations: {
      label: 'Reservations',
      scopes: [
        { value: 'read:reservations', label: 'Read Reservations', description: 'View reservations' },
        { value: 'write:reservations', label: 'Write Reservations', description: 'Manage reservations' },
      ],
    },
    payments: {
      label: 'Payments',
      scopes: [
        { value: 'read:payments', label: 'Read Payments', description: 'View payment information' },
        { value: 'write:payments', label: 'Write Payments', description: 'Process payments' },
      ],
    },
    webhooks: {
      label: 'Webhooks',
      scopes: [
        { value: 'webhooks', label: 'Webhooks', description: 'Manage and receive webhooks' },
      ],
    },
    admin: {
      label: 'Administration',
      scopes: [
        { value: 'admin:full', label: 'Full Admin Access', description: 'Full administrative access (use with caution)' },
      ],
    },
  };

  return res.json({
    success: true,
    data: scopeGroups,
  });
}));

/**
 * GET /api/api-keys/webhooks/events
 * Get available webhook event types
 */
router.get('/webhooks/events', requireAuth, asyncHandler(async (_req: Request, res: Response) => {
  const eventTypes: { value: WebhookEventType; label: string; description: string }[] = [
    { value: 'order.created', label: 'Order Created', description: 'Triggered when a new order is created' },
    { value: 'order.updated', label: 'Order Updated', description: 'Triggered when an order is updated' },
    { value: 'order.completed', label: 'Order Completed', description: 'Triggered when an order is completed' },
    { value: 'order.cancelled', label: 'Order Cancelled', description: 'Triggered when an order is cancelled' },
    { value: 'menu.updated', label: 'Menu Updated', description: 'Triggered when menu items are updated' },
    { value: 'inventory.low_stock', label: 'Low Stock Alert', description: 'Triggered when inventory falls below threshold' },
    { value: 'customer.created', label: 'Customer Created', description: 'Triggered when a new customer is created' },
    { value: 'payment.received', label: 'Payment Received', description: 'Triggered when a payment is received' },
    { value: 'reservation.created', label: 'Reservation Created', description: 'Triggered when a new reservation is made' },
    { value: 'reservation.updated', label: 'Reservation Updated', description: 'Triggered when a reservation is updated' },
  ];

  return res.json({
    success: true,
    data: eventTypes,
  });
}));

export default router;
