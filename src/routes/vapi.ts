import { Router, Request, Response } from 'express';
import { VapiService, VapiWebhookPayload } from '../services/VapiService';
import { logger } from '../utils/logger';
import { DatabaseService } from '../services/DatabaseService';
import { validateEnvironment } from '../utils/validateEnv';
import { checkUploadsHealth, UPLOADS_DIR } from '../utils/uploads';
import { requireVapiWebhookAuth } from '../middleware/vapiAuth';

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
  const parameters =
    (body as any)?.parameters ??
    (body as any)?.args ??
    (body as any)?.input ??
    body;
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

  try {
    const exec = await vapiService.executeToolRequest(toolName, parameters, {
      callId,
      customerNumber
    });

    if (exec.error) {
      return res.status(200).json({ error: exec.error });
    }

    return res.status(200).json(exec.result ?? { ok: true });
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
    // Return the assistant configuration that Vapi will use
    const config = {
      model: {
        provider: 'openai',
        model: 'gpt-4',
        temperature: 0.3,
        maxTokens: 1000,
        systemMessage: vapiService.getPhoneSystemPrompt()
      },
      voice: {
        provider: 'openai',
        voiceId: 'alloy', // Can be changed to other voices: echo, fable, onyx, nova, shimmer
        speed: 1.0,
        chunkPlan: {
          enabled: true,
          minCharacters: 30,
          punctuationBoundaries: ['.', '!', '?', ';', ':', '\n'],
          formatPlan: {
            enabled: true,
            numberToDigitsCutoff: 2025
          }
        }
      },
      firstMessage: "Hi! Welcome to our restaurant. I'm Servio, your AI assistant. I can help you place an order, check our menu, or answer questions about our food. What would you like today?",
      endCallMessage: "Thank you for calling! Your order has been placed and you'll receive a confirmation shortly. Have a great day!",
      endCallPhrases: ["goodbye", "bye", "that's all", "hang up", "end call"],
      recordingEnabled: true,
      maxDurationSeconds: 600, // 10 minutes max call duration
      silenceTimeoutSeconds: 30,
      responseDelaySeconds: 1,
      llmRequestDelaySeconds: 0.1,
      numWordsToInterruptAssistant: 2,
      maxTokens: 1000,
      emotionRecognitionEnabled: false,
      backchannelingEnabled: false,
      backgroundDenoisingEnabled: true,
      modelOutputInMessagesEnabled: false,
      transportConfigurations: [{
        provider: 'twilio',
        timeout: 60,
        record: false
      }],
      functions: [
        {
          name: 'getStoreStatus',
          description: 'Check if the restaurant is currently open and get operating hours',
          parameters: { type: 'object', properties: {} }
        },
        {
          name: 'searchMenu',
          description: 'Search for items on the menu by name or category',
          parameters: {
            type: 'object',
            properties: {
              q: { type: 'string', description: 'Search query' }
            }
          }
        },
        {
          name: 'getMenuItem',
          description: 'Get full details for a specific menu item by ID',
          parameters: {
            type: 'object',
            properties: {
              id: { type: 'string', description: 'The item ID' }
            },
            required: ['id']
          }
        },
        {
          name: 'quoteOrder',
          description: 'Validate an order and get the subtotal, tax, and total before placing it',
          parameters: {
            type: 'object',
            properties: {
              items: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    itemId: { type: 'string' },
                    qty: { type: 'number' },
                    modifiers: { type: 'object' }
                  },
                  required: ['itemId', 'qty']
                }
              },
              orderType: { type: 'string', enum: ['pickup', 'delivery', 'dine-in'] }
            },
            required: ['items', 'orderType']
          }
        },
        {
          name: 'createOrder',
          description: 'Place the final order in the system as received',
          parameters: {
            type: 'object',
            properties: {
              items: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    itemId: { type: 'string', description: 'Menu item ID' },
                    qty: { type: 'number', description: 'Quantity' },
                    modifiers: { type: 'object', description: 'Modifier selections keyed by modifier group id' }
                  },
                  required: ['itemId', 'qty']
                }
              },
              customer: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  phone: { type: 'string' },
                  email: { type: 'string' },
                  lastInitial: { type: 'string' }
                },
                required: ['name', 'phone']
              },
              totals: {
                type: 'object',
                properties: {
                  subtotal: { type: 'number' },
                  tax: { type: 'number' },
                  fees: { type: 'number' },
                  total: { type: 'number' }
                },
                required: ['subtotal', 'tax', 'fees', 'total']
              },
              orderType: { type: 'string', enum: ['pickup', 'delivery', 'dine-in'] },
              pickupTime: { type: 'string' },
              callId: { type: 'string' }
            },
            required: ['items', 'customer', 'orderType', 'totals']
          }
        }
      ]
    };

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