import { Router, Request, Response } from 'express';
import { VapiService, VapiWebhookPayload } from '../services/VapiService';
import { logger } from '../utils/logger';

const router = Router();
const vapiService = new VapiService();

// Webhook endpoint for Vapi
router.post('/webhook', async (req: Request, res: Response) => {
  try {
    const payload: VapiWebhookPayload = req.body;
    
    // Log incoming webhook for debugging
    logger.info('Vapi webhook received:', {
      type: payload.message.type,
      callId: payload.message.call?.id,
      customerNumber: payload.message.call?.customer?.number
    });

    const response = await vapiService.handleWebhook(payload);
    
    res.json(response);
  } catch (error) {
    logger.error('Vapi webhook error:', error);
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