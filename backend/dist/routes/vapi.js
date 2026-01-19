"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const VapiService_1 = require("../services/VapiService");
const logger_1 = require("../utils/logger");
const router = (0, express_1.Router)();
const vapiService = new VapiService_1.VapiService();
// Webhook endpoint for Vapi
router.post('/webhook', async (req, res) => {
    try {
        const payload = req.body;
        // Log incoming webhook for debugging
        logger_1.logger.info('Vapi webhook received:', {
            type: payload.message.type,
            callId: payload.message.call?.id,
            customerNumber: payload.message.call?.customer?.number
        });
        const response = await vapiService.handleWebhook(payload);
        res.json(response);
    }
    catch (error) {
        logger_1.logger.error('Vapi webhook error:', error);
        res.status(500).json({
            error: 'Internal server error',
            result: 'I apologize, but I\'m experiencing technical difficulties. Please try again or hold for a human representative.'
        });
    }
});
// Get Vapi assistant configuration
router.get('/assistant-config', async (req, res) => {
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
                    name: 'place_order',
                    description: 'Place a new food order for the customer',
                    parameters: {
                        type: 'object',
                        properties: {
                            items: {
                                type: 'array',
                                description: 'List of items to order',
                                items: {
                                    type: 'object',
                                    properties: {
                                        name: { type: 'string', description: 'Name of the menu item' },
                                        quantity: { type: 'number', description: 'Quantity to order' },
                                        specialInstructions: { type: 'string', description: 'Any special preparation instructions' }
                                    },
                                    required: ['name', 'quantity']
                                }
                            },
                            customerInfo: {
                                type: 'object',
                                properties: {
                                    name: { type: 'string', description: 'Customer name' },
                                    phone: { type: 'string', description: 'Customer phone number' },
                                    email: { type: 'string', description: 'Customer email address' }
                                },
                                required: ['name', 'phone']
                            },
                            deliveryAddress: {
                                type: 'object',
                                properties: {
                                    street: { type: 'string' },
                                    city: { type: 'string' },
                                    state: { type: 'string' },
                                    zipCode: { type: 'string' },
                                    deliveryInstructions: { type: 'string' }
                                }
                            },
                            orderType: {
                                type: 'string',
                                enum: ['pickup', 'delivery', 'dine-in'],
                                description: 'Type of order'
                            }
                        },
                        required: ['items', 'customerInfo', 'orderType']
                    }
                },
                {
                    name: 'get_menu_info',
                    description: 'Get information about menu items including availability and prices',
                    parameters: {
                        type: 'object',
                        properties: {
                            category: {
                                type: 'string',
                                description: 'Menu category to search (appetizers, entrees, desserts, etc.)'
                            },
                            itemName: {
                                type: 'string',
                                description: 'Specific item name to search for'
                            }
                        }
                    }
                },
                {
                    name: 'check_order_status',
                    description: 'Check the status of an existing order',
                    parameters: {
                        type: 'object',
                        properties: {
                            orderId: {
                                type: 'string',
                                description: 'Order ID or confirmation number'
                            },
                            phoneNumber: {
                                type: 'string',
                                description: 'Customer phone number to lookup orders'
                            }
                        }
                    }
                }
            ]
        };
        res.json(config);
    }
    catch (error) {
        logger_1.logger.error('Error getting assistant config:', error);
        res.status(500).json({ error: 'Failed to get assistant configuration' });
    }
});
// Health check endpoint
router.get('/health', (req, res) => {
    res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});
exports.default = router;
//# sourceMappingURL=vapi.js.map