import { Router, Request, Response } from 'express';
import { VapiService, VapiWebhookPayload } from '../services/VapiService';
import { logger } from '../utils/logger';

const router = Router();
const vapiService = new VapiService();

function safeJsonParse(value: unknown): any | undefined {
  if (typeof value !== 'string') return undefined;
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}

/**
 * Vapi can hit this endpoint in two ways:
 * 1) Standard webhook event payloads: { message: { type, call?, functionCall? ... } }
 * 2) "Tool" apiRequest payloads (shape varies). In that case, we normalize into (1).
 */
function normalizeToVapiWebhookPayload(body: any): VapiWebhookPayload | null {
  if (body?.message?.type) return body as VapiWebhookPayload;

  // Common tool payload shapes (best-effort).
  // Vapi can post a single toolCall, or an array of toolCalls (sometimes nested under message).
  const toolCall =
    body?.toolCall ||
    (Array.isArray(body?.toolCalls) ? body.toolCalls[0] : undefined) ||
    body?.message?.toolCall ||
    (Array.isArray(body?.message?.toolCalls) ? body.message.toolCalls[0] : undefined);

  const name =
    body?.message?.functionCall?.name ||
    body?.functionCall?.name ||
    body?.toolName ||
    body?.name ||
    toolCall?.function?.name ||
    toolCall?.name ||
    body?.function?.name;

  const toolArgsRaw =
    toolCall?.function?.arguments ??
    toolCall?.arguments ??
    body?.function?.arguments ??
    body?.arguments;

  const toolArgsParsed =
    typeof toolArgsRaw === 'string' ? safeJsonParse(toolArgsRaw) : toolArgsRaw;

  const parameters =
    body?.message?.functionCall?.parameters ||
    body?.functionCall?.parameters ||
    body?.parameters ||
    toolArgsParsed ||
    // Some tools might post fields directly
    (typeof body?.q === 'string' ? { q: body.q } : undefined) ||
    {};

  if (!name) return null;

  const call =
    body?.message?.call ||
    body?.call ||
    (body?.callId || body?.phoneNumberId || body?.customerNumber
      ? {
          id: body?.callId ?? 'unknown',
          orgId: body?.orgId ?? 'unknown',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          type: 'webCall' as const,
          phoneNumberId: body?.phoneNumberId,
          customer: body?.customerNumber ? { number: body.customerNumber } : undefined,
          status: 'in-progress' as const
        }
      : undefined);

  return {
    message: {
      type: 'function-call',
      call,
      functionCall: { name, parameters }
    }
  };
}

// Webhook endpoint for Vapi
router.post('/webhook', async (req: Request, res: Response) => {
  const startTime = Date.now();
  try {
    const rawBody = req.body;
    const payload = normalizeToVapiWebhookPayload(rawBody);

    if (!payload) {
      logger.warn('⚠️ Vapi webhook received unknown payload shape', {
        keys: rawBody && typeof rawBody === 'object' ? Object.keys(rawBody).slice(0, 50) : typeof rawBody,
        body_preview: (() => {
          try {
            return JSON.stringify(rawBody).slice(0, 1000);
          } catch {
            return String(rawBody).slice(0, 1000);
          }
        })()
      });
      return res.status(400).json({
        error: 'Bad request',
        result: "I'm sorry, I couldn't process that request. Please try again."
      });
    }
    
    // STRUCTURED LOGGING - Entry point
    logger.info('🔔 Vapi webhook received', {
      event_type: payload.message.type,
      call_id: payload.message.call?.id,
      phone_number_id: payload.message.call?.phoneNumberId,
      customer_number: payload.message.call?.customer?.number,
      function_name: payload.message.functionCall?.name,
      function_params: payload.message.functionCall?.parameters,
      timestamp: new Date().toISOString()
    });

    const response = await vapiService.handleWebhook(payload);
    const duration = Date.now() - startTime;
    
    logger.info('✅ Vapi webhook completed', {
      call_id: payload.message.call?.id,
      event_type: payload.message.type,
      duration_ms: duration,
      response_preview: typeof response?.result === 'string' 
        ? response.result.substring(0, 100) 
        : response?.result 
          ? JSON.stringify(response.result).substring(0, 100)
          : 'no result'
    });
    
    res.json(response);
  } catch (error) {
    logger.error('❌ Vapi webhook error', { 
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      duration_ms: Date.now() - startTime
    });
    res.status(500).json({ 
      error: 'Internal server error',
      result: 'I apologize, but I\'m experiencing technical difficulties. Please try again or hold for a human representative.'
    });
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
              orderType: { type: 'string', enum: ['pickup', 'delivery'] }
            },
            required: ['items', 'orderType']
          }
        },
        {
          name: 'createOrder',
          description: 'Place the final order in the system as PENDING',
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
              customer: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  phone: { type: 'string' },
                  lastInitial: { type: 'string' }
                },
                required: ['name', 'phone', 'lastInitial']
              },
              orderType: { type: 'string', enum: ['pickup', 'delivery'] },
              pickupTime: { type: 'string' },
              callId: { type: 'string' }
            },
            required: ['items', 'customer', 'orderType']
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
router.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

export default router;