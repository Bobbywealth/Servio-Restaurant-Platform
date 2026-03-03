import { Router, Request, Response } from 'express';
import { VapiService, VapiWebhookPayload } from '../services/VapiService';
import { logger } from '../utils/logger';
import { DatabaseService } from '../services/DatabaseService';
import { validateEnvironment } from '../utils/validateEnv';
import { checkUploadsHealth, UPLOADS_DIR } from '../utils/uploads';
import { requireVapiWebhookAuth } from '../middleware/vapiAuth';
import { buildVapiAssistantConfig } from '../services/vapiAssistantConfig';

const router = Router();
const vapiService = new VapiService();

// Webhook endpoint for Vapi
router.post('/webhook', requireVapiWebhookAuth, async (req: Request, res: Response) => {
  const requestId = (req.headers['x-request-id'] as string) || `vapi_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const contentType = req.headers['content-type'];

  const log = (level: 'info' | 'warn' | 'error', message: string, extra?: Record<string, unknown>) => {
    logger[level](`[vapi:webhook] ${message}`, {
      requestId,
      contentType,
      bodyKeys: req.body && typeof req.body === 'object' ? Object.keys(req.body) : undefined,
      bodyType: (req.body as any)?.type ?? (req.body as any)?.message?.type,
      ...extra,
    });
  };

  try {
    if (!req.body || typeof req.body !== 'object') {
      log('warn', 'missing_or_invalid_body');
      return res.status(200).json({ ok: true });
    }

    const payload: VapiWebhookPayload = req.body;
    const message = (payload as any)?.message;

    if (!message || !message.type) {
      log('warn', 'missing_type_or_message');
      return res.status(200).json({ ok: true });
    }
    
    // Log incoming webhook for debugging (avoid PII)
    log('info', 'received', {
      type: message.type,
      callId: message.call?.id
    });

    const response = await vapiService.handleWebhook(payload);
    
    res.status(200).json(response);
  } catch (error) {
    log('error', 'handler_error', { error: error instanceof Error ? error.message : String(error) });
    res.status(200).json({ ok: true });
  }
});

// Tool endpoint for Vapi tool server calls (apiRequest/function tools)
router.post('/tool/:toolName', requireVapiWebhookAuth, async (req: Request, res: Response) => {
  const toolNameParam = req.params.toolName;
  const toolName = Array.isArray(toolNameParam) ? toolNameParam[0] : toolNameParam;
  const body = req.body && typeof req.body === 'object' ? req.body : {};

  // Log raw request to diagnose what Vapi is sending (use console.log to avoid logger truncation)
  const bodyStr = JSON.stringify(body);
  const queryStr = JSON.stringify(req.query);
  const bodyKeys = Object.keys(body);
  console.log(`[VAPI_DEBUG] POST /tool/${toolName}`);
  console.log(`[VAPI_DEBUG] body_keys=${JSON.stringify(bodyKeys)}`);
  console.log(`[VAPI_DEBUG] body=${bodyStr.slice(0, 1500)}`);
  console.log(`[VAPI_DEBUG] query=${queryStr}`);
  console.log(`[VAPI_DEBUG] url=${req.originalUrl}`);

  const headerRestaurantId =
    (req.headers['x-vapi-restaurant-id'] as string) ||
    (req.headers['x-restaurant-id'] as string);
  const headerRestaurantSlug =
    (req.headers['x-vapi-restaurant-slug'] as string) ||
    (req.headers['x-restaurant-slug'] as string);
  const headerPhoneNumberId =
    (req.headers['x-vapi-phone-number-id'] as string) ||
    (req.headers['x-phone-number-id'] as string);

  // Merge query params into body for tools that send via URL
  const mergedParams = {
    ...req.query,
    ...body,
    ...(headerRestaurantId ? { restaurantId: headerRestaurantId } : {}),
    ...(headerRestaurantSlug ? { restaurantSlug: headerRestaurantSlug } : {})
  };

  const parameters =
    (mergedParams as any)?.parameters ??
    (mergedParams as any)?.args ??
    (mergedParams as any)?.input ??
    (mergedParams as any)?.message?.toolCalls?.[0]?.function?.arguments ??
    mergedParams;
  const headerCallId = req.headers['x-vapi-call-id'];
  const headerCallIdValue = Array.isArray(headerCallId) ? headerCallId[0] : headerCallId;
  const callIdRaw = (body as any)?.callId || (body as any)?.call?.id || headerCallIdValue;
  const callId =
    typeof callIdRaw === 'string'
      ? callIdRaw
      : Array.isArray(callIdRaw)
        ? callIdRaw[0]
        : undefined;
  const customerNumberRaw =
    (body as any)?.customerNumber || (body as any)?.customer?.number || (body as any)?.call?.customer?.number;
  const customerNumber =
    typeof customerNumberRaw === 'string'
      ? customerNumberRaw
      : Array.isArray(customerNumberRaw)
        ? customerNumberRaw[0]
        : undefined;
  const phoneNumberIdRaw =
    (body as any)?.phoneNumberId ||
    (body as any)?.call?.phoneNumberId ||
    (body as any)?.call?.phone?.numberId ||
    headerPhoneNumberId;
  const phoneNumberId =
    typeof phoneNumberIdRaw === 'string'
      ? phoneNumberIdRaw
      : Array.isArray(phoneNumberIdRaw)
        ? phoneNumberIdRaw[0]
        : undefined;

  try {
    const exec = await vapiService.executeToolRequest(toolName, parameters, {
      callId,
      customerNumber,
      phoneNumberId
    });

    const resultPayload = exec.error ? { ok: false, error: exec.error } : exec.result ?? { ok: true };
    const result = typeof resultPayload === 'string' ? resultPayload : JSON.stringify(resultPayload);

    // Vapi tool servers expect a top-level `result` string.
    return res.status(200).json({
      result,
      ...(exec.error ? { error: exec.error } : {})
    });
  } catch (error) {
    logger.error('[vapi:tool] handler_error', {
      toolName,
      callId,
      error: error instanceof Error ? error.message : String(error)
    });
    return res.status(200).json({ error: 'Internal server error' });
  }
});

// Some tool-server configurations call tools via GET with query params.
// Support both POST and GET to avoid 404s like: "Route GET /api/vapi/tool/searchMenu not found".
router.get('/tool/:toolName', requireVapiWebhookAuth, async (req: Request, res: Response) => {
  const toolNameParam = req.params.toolName;
  const toolName = Array.isArray(toolNameParam) ? toolNameParam[0] : toolNameParam;

  const headerCallId = req.headers['x-vapi-call-id'];
  const headerRestaurantId =
    (req.headers['x-vapi-restaurant-id'] as string) ||
    (req.headers['x-restaurant-id'] as string);
  const headerRestaurantSlug =
    (req.headers['x-vapi-restaurant-slug'] as string) ||
    (req.headers['x-restaurant-slug'] as string);
  const headerPhoneNumberId =
    (req.headers['x-vapi-phone-number-id'] as string) ||
    (req.headers['x-phone-number-id'] as string);
  const headerCallIdValue = Array.isArray(headerCallId) ? headerCallId[0] : headerCallId;
  const callIdRaw = (req.query as any)?.callId || headerCallIdValue;
  const callId =
    typeof callIdRaw === 'string'
      ? callIdRaw
      : Array.isArray(callIdRaw)
        ? callIdRaw[0]
        : undefined;

  const customerNumberRaw = (req.query as any)?.customerNumber;
  const customerNumber =
    typeof customerNumberRaw === 'string'
      ? customerNumberRaw
      : Array.isArray(customerNumberRaw)
        ? customerNumberRaw[0]
        : undefined;
  const phoneNumberIdRaw = (req.query as any)?.phoneNumberId || headerPhoneNumberId;
  const phoneNumberId =
    typeof phoneNumberIdRaw === 'string'
      ? phoneNumberIdRaw
      : Array.isArray(phoneNumberIdRaw)
        ? phoneNumberIdRaw[0]
        : undefined;

  try {
    const parameters = {
      ...req.query,
      ...(headerRestaurantId ? { restaurantId: headerRestaurantId } : {}),
      ...(headerRestaurantSlug ? { restaurantSlug: headerRestaurantSlug } : {})
    };
    const exec = await vapiService.executeToolRequest(toolName, parameters, {
      callId,
      customerNumber,
      phoneNumberId
    });

    const resultPayload = exec.error ? { ok: false, error: exec.error } : exec.result ?? { ok: true };
    const result = typeof resultPayload === 'string' ? resultPayload : JSON.stringify(resultPayload);

    return res.status(200).json({
      result,
      ...(exec.error ? { error: exec.error } : {})
    });
  } catch (error) {
    logger.error('[vapi:tool] handler_error', {
      toolName,
      callId,
      error: error instanceof Error ? error.message : String(error)
    });
    return res.status(200).json({ error: 'Internal server error' });
  }
});

// Get Vapi assistant configuration
router.get('/assistant-config', async (req: Request, res: Response) => {
  try {
    const fallbackRestaurantId =
      typeof process.env.VAPI_RESTAURANT_ID === 'string' && process.env.VAPI_RESTAURANT_ID.trim().length > 0
        ? process.env.VAPI_RESTAURANT_ID.trim()
        : undefined;
    const assistantId =
      typeof process.env.VAPI_ASSISTANT_ID === 'string' && process.env.VAPI_ASSISTANT_ID.trim().length > 0
        ? process.env.VAPI_ASSISTANT_ID.trim()
        : undefined;

    const config = buildVapiAssistantConfig(vapiService, {
      restaurantId: fallbackRestaurantId,
      assistantId
    });

    res.json(config);
  } catch (error) {
    logger.error('Error getting assistant config:', error);
    res.status(500).json({ error: 'Failed to get assistant configuration' });
  }
});

// Health check endpoint
router.get('/health', async (req: Request, res: Response) => {
  // Keep this endpoint lightweight but informative in production.
  const envStatus = validateEnvironment();

  let dbStatus: 'connected' | 'disconnected' | 'unknown' = 'unknown';
  let dbError: string | undefined;
  try {
    const db = DatabaseService.getInstance().getDatabase();
    await db.get('SELECT 1 as ok');
    dbStatus = 'connected';
  } catch (err) {
    dbStatus = 'disconnected';
    dbError = err instanceof Error ? err.message : 'Unknown error';
  }

  const uploadsHealth = await checkUploadsHealth();

  const isHealthy = envStatus.valid && dbStatus === 'connected' && uploadsHealth.ok;
  res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    services: {
      database: dbStatus,
      assistant: envStatus.services.assistant,
      auth: envStatus.services.auth,
      uploads: uploadsHealth.ok ? 'ok' : 'error',
    },
    config: {
      uploadsDir: UPLOADS_DIR,
    },
    ...(process.env.NODE_ENV !== 'production' || req.query.verbose === 'true'
      ? { errors: { env: envStatus.errors, db: dbError, uploads: uploadsHealth.error } }
      : {}),
  });
});

export default router;
