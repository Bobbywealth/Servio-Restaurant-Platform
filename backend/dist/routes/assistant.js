"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const AssistantService_1 = require("../services/AssistantService");
const logger_1 = require("../utils/logger");
const errorHandler_1 = require("../middleware/errorHandler");
const router = (0, express_1.Router)();
// Configure multer for audio file uploads
const upload = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    limits: {
        fileSize: 25 * 1024 * 1024, // 25MB limit
    },
    fileFilter: (req, file, cb) => {
        // Accept audio files
        if (file.mimetype.startsWith('audio/')) {
            cb(null, true);
        }
        else {
            cb(new Error('Only audio files are allowed'), false);
        }
    }
});
const assistantService = new AssistantService_1.AssistantService();
/**
 * POST /api/assistant/process-audio
 * Process audio input from microphone
 */
router.post('/process-audio', upload.single('audio'), (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { userId } = req.body;
    const audioFile = req.file;
    if (!audioFile) {
        return res.status(400).json({
            success: false,
            error: { message: 'No audio file provided' }
        });
    }
    if (!userId) {
        return res.status(400).json({
            success: false,
            error: { message: 'User ID is required' }
        });
    }
    logger_1.logger.info(`Processing audio for user ${userId}, file size: ${audioFile.size} bytes`);
    try {
        const result = await assistantService.processAudio(audioFile.buffer, userId);
        res.json({
            success: true,
            data: result
        });
    }
    catch (error) {
        logger_1.logger.error('Audio processing error:', error);
        res.status(500).json({
            success: false,
            error: {
                message: 'Failed to process audio',
                details: error instanceof Error ? error.message : 'Unknown error'
            }
        });
    }
}));
/**
 * POST /api/assistant/process-text
 * Process text input (from quick commands or typed input)
 */
router.post('/process-text', (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { text, userId } = req.body;
    if (!text || typeof text !== 'string') {
        return res.status(400).json({
            success: false,
            error: { message: 'Text input is required' }
        });
    }
    if (!userId) {
        return res.status(400).json({
            success: false,
            error: { message: 'User ID is required' }
        });
    }
    logger_1.logger.info(`Processing text for user ${userId}: "${text.substring(0, 100)}${text.length > 100 ? '...' : ''}"`);
    try {
        const result = await assistantService.processText(text, userId);
        res.json({
            success: true,
            data: result
        });
    }
    catch (error) {
        logger_1.logger.error('Text processing error:', error);
        res.status(500).json({
            success: false,
            error: {
                message: 'Failed to process text',
                details: error instanceof Error ? error.message : 'Unknown error'
            }
        });
    }
}));
/**
 * GET /api/assistant/status
 * Get assistant service status and configuration
 */
router.get('/status', (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const status = {
        service: 'online',
        features: {
            speechToText: process.env.OPENAI_API_KEY ? 'available' : 'unavailable',
            textToSpeech: process.env.ELEVENLABS_API_KEY ? 'available' : 'limited',
            llm: process.env.OPENAI_API_KEY ? 'available' : 'unavailable'
        },
        capabilities: [
            'Order management',
            'Inventory tracking',
            'Menu availability (86 items)',
            'Task management',
            'Audit logging'
        ],
        version: '1.0.0'
    };
    res.json({
        success: true,
        data: status
    });
}));
/**
 * GET /api/assistant/conversation/:userId
 * Get conversation history for a user (if we implement conversation storage)
 */
router.get('/conversation/:userId', (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { userId } = req.params;
    const { limit = 50 } = req.query;
    // For now, return empty - this could be implemented to store conversation history
    res.json({
        success: true,
        data: {
            messages: [],
            totalCount: 0
        }
    });
}));
/**
 * DELETE /api/assistant/conversation/:userId
 * Clear conversation history for a user
 */
router.delete('/conversation/:userId', (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { userId } = req.params;
    // For now, just return success - this could clear stored conversation history
    logger_1.logger.info(`Conversation history cleared for user ${userId}`);
    res.json({
        success: true,
        message: 'Conversation history cleared'
    });
}));
/**
 * POST /api/assistant/feedback
 * Submit feedback about assistant responses
 */
router.post('/feedback', (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { userId, messageId, rating, comment } = req.body;
    if (!userId || !messageId || rating === undefined) {
        return res.status(400).json({
            success: false,
            error: { message: 'userId, messageId, and rating are required' }
        });
    }
    // Log feedback for analysis
    logger_1.logger.info('Assistant feedback received:', {
        userId,
        messageId,
        rating,
        comment: comment ? comment.substring(0, 200) : undefined
    });
    // In a real application, you'd store this in the database
    res.json({
        success: true,
        message: 'Feedback recorded'
    });
}));
/**
 * GET /api/assistant/tools
 * Get list of available tools and their descriptions
 */
router.get('/tools', (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const tools = [
        {
            name: 'get_orders',
            description: 'Retrieve current orders with optional status filtering',
            category: 'Orders',
            permissions: ['orders.read']
        },
        {
            name: 'update_order_status',
            description: 'Update order status (received, preparing, ready, completed)',
            category: 'Orders',
            permissions: ['orders.update']
        },
        {
            name: 'set_item_availability',
            description: '86 items or restore availability on delivery platforms',
            category: 'Menu',
            permissions: ['menu.availability']
        },
        {
            name: 'get_inventory',
            description: 'Check inventory levels and low stock items',
            category: 'Inventory',
            permissions: ['inventory.read']
        },
        {
            name: 'adjust_inventory',
            description: 'Add or remove inventory quantities',
            category: 'Inventory',
            permissions: ['inventory.adjust']
        },
        {
            name: 'get_tasks',
            description: 'View daily, weekly, and monthly tasks',
            category: 'Tasks',
            permissions: ['tasks.read']
        },
        {
            name: 'complete_task',
            description: 'Mark tasks as completed',
            category: 'Tasks',
            permissions: ['tasks.update']
        }
    ];
    res.json({
        success: true,
        data: { tools }
    });
}));
/**
 * Error handling for multer
 */
router.use((error, req, res, next) => {
    if (error instanceof multer_1.default.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({
                success: false,
                error: { message: 'Audio file too large. Maximum size is 25MB.' }
            });
        }
    }
    if (error.message === 'Only audio files are allowed') {
        return res.status(400).json({
            success: false,
            error: { message: 'Only audio files are accepted.' }
        });
    }
    next(error);
});
exports.default = router;
//# sourceMappingURL=assistant.js.map