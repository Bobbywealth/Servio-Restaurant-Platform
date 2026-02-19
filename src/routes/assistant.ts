import { Router, Request, Response } from 'express';
import fs from 'fs/promises';
import path from 'path';
import multer from 'multer';
import { AssistantService } from '../services/AssistantService';
import { VoiceConversationService } from '../services/VoiceConversationService';
import { DatabaseService } from '../services/DatabaseService';
import { logger } from '../utils/logger';
import { asyncHandler, BadRequestError, UnauthorizedError } from '../middleware/errorHandler';

const router = Router();

// Configure multer for audio file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024, // 25MB limit
  },
  fileFilter: (req, file, cb: any) => {
    // Accept audio files
    if (file.mimetype.startsWith('audio/')) {
      cb(null, true);
    } else {
      cb(new Error('Only audio files are allowed'), false);
    }
  }
});

const assistantService = new AssistantService();
const voiceConversationService = VoiceConversationService.getInstance();

const parsePositiveNumber = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
};

const parseSafeString = (value: unknown, fallback = 'unknown'): string => {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : fallback;
};

const parseRestaurantId = (value: unknown): string => {
  if (Array.isArray(value)) {
    return parseSafeString(value[0], '');
  }

  return parseSafeString(value, '');
};

const parseRecentErrors = async (limit = 5): Promise<Array<{ message: string; level: string; occurredAt: string; source: string }>> => {
  const errorLogPath = path.resolve(process.cwd(), 'logs/error.log');

  try {
    const content = await fs.readFile(errorLogPath, 'utf8');
    if (!content) {
      return [];
    }

    const lines = content
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .filter((line) => /assistant|voice|vapi/i.test(line));

    return lines.slice(-limit).reverse().map((line) => {
      const timestampMatch = line.match(/^(\d{4}-\d{2}-\d{2}[^[]+)/);
      const levelMatch = line.match(/\[(error|warn|info|debug)\]/i);

      return {
        message: line,
        level: levelMatch?.[1]?.toLowerCase() || 'error',
        occurredAt: timestampMatch?.[1]?.trim() || new Date(0).toISOString(),
        source: line.includes('vapi') ? 'vapi' : 'assistant'
      };
    });
  } catch {
    return [];
  }
};

/**
 * POST /api/assistant/process-audio
 * Process audio input from microphone
 */
router.post('/process-audio', upload.single('audio'), asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  const audioFile = req.file;

  if (!audioFile) {
    return res.status(400).json({
      success: false,
      error: { message: 'No audio file provided' }
    });
  }

  if (!userId) {
    throw new UnauthorizedError();
  }

  logger.info(`Processing audio for user ${userId}, file size: ${audioFile.size} bytes`);

  try {
    const result = await assistantService.processAudio(audioFile.buffer, userId);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('Audio processing error:', error);
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
router.post('/process-text', asyncHandler(async (req: Request, res: Response) => {
  const { text } = req.body;
  const userId = req.user?.id;

  if (!text || typeof text !== 'string') {
    return res.status(400).json({
      success: false,
      error: { message: 'Text input is required' }
    });
  }

  if (!userId) {
    throw new UnauthorizedError();
  }

  logger.info(`Processing text for user ${userId}: "${text.substring(0, 100)}${text.length > 100 ? '...' : ''}"`);

  try {
    const result = await assistantService.processText(text, userId);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('Text processing error:', error);
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
 * POST /api/assistant/process-text-stream
 * Process text input with streaming response (Server-Sent Events)
 */
router.post('/process-text-stream', asyncHandler(async (req: Request, res: Response) => {
  const { text } = req.body;
  const userId = req.user?.id;

  if (!text || typeof text !== 'string') {
    return res.status(400).json({
      success: false,
      error: { message: 'Text input is required' }
    });
  }

  if (!userId) {
    throw new UnauthorizedError();
  }

  logger.info(`Processing text stream for user ${userId}: "${text.substring(0, 100)}${text.length > 100 ? '...' : ''}"`);

  // Set headers for Server-Sent Events
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

  try {
    // Stream the response
    for await (const chunk of assistantService.processTextStream(text, userId)) {
      res.write(`data: ${JSON.stringify(chunk)}\n\n`);
    }

    res.end();
  } catch (error) {
    logger.error('Text streaming error:', error);
    const errorChunk = {
      type: 'error',
      error: error instanceof Error ? error.message : 'Unknown error'
    };
    res.write(`data: ${JSON.stringify(errorChunk)}\n\n`);
    res.end();
  }
}));

/**
 * GET /api/assistant/status
 * Get assistant service status and configuration
 */
router.get('/status', asyncHandler(async (req: Request, res: Response) => {
  // Determine which AI provider is being used
  const usesMiniMax = Boolean(process.env.MINIMAX_API_KEY);
  const usesOpenAI = Boolean(process.env.OPENAI_API_KEY);
  const restaurantId = parseRestaurantId(req.user?.restaurantId);

  let aiProvider = 'unknown';
  if (usesMiniMax) {
    aiProvider = 'minimax';
  } else if (usesOpenAI) {
    aiProvider = 'openai';
  }

  const defaultConversationStats = {
    total: 0,
    active: 0,
    completed: 0,
    abandoned: 0,
    avgMessages: 0
  };

  let conversationStats = defaultConversationStats;
  let recentOutcomeRows: any[] = [];

  if (restaurantId) {
    try {
      conversationStats = await voiceConversationService.getStatistics(restaurantId);
      const db = DatabaseService.getInstance().getDatabase();
      recentOutcomeRows = await db.all(
        `SELECT id, status, updated_at
         FROM voice_conversations
         WHERE restaurant_id = ?
         ORDER BY updated_at DESC
         LIMIT 25`,
        [restaurantId]
      );
    } catch (error) {
      logger.warn('[assistant.status] Failed to load voice conversation stats', {
        restaurantId,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  const normalizedStats = {
    total: parsePositiveNumber(conversationStats.total),
    active: parsePositiveNumber(conversationStats.active),
    completed: parsePositiveNumber(conversationStats.completed),
    abandoned: parsePositiveNumber(conversationStats.abandoned),
    avgMessages: parsePositiveNumber(conversationStats.avgMessages)
  };

  const successCount = parsePositiveNumber(normalizedStats.completed);
  const failureCount = parsePositiveNumber(normalizedStats.abandoned);
  const successDenominator = Math.max(successCount + failureCount, 1);

  const recentIncidentsFromConversations = recentOutcomeRows
    .filter((row) => parseSafeString(row?.status) === 'abandoned')
    .slice(0, 5)
    .map((row) => ({
      id: parseSafeString(row?.id, `incident-${Date.now()}`),
      type: 'conversation_abandoned',
      source: 'voice-conversations',
      message: 'Voice conversation ended as abandoned',
      severity: 'warning',
      occurredAt: parseSafeString(row?.updated_at, new Date(0).toISOString())
    }));

  const recentLogErrors = await parseRecentErrors(5);
  const recentIncidentsFromLogs = recentLogErrors.map((entry, index) => ({
    id: `${entry.source}-${index}-${Date.now()}`,
    type: 'runtime_error',
    source: entry.source,
    message: entry.message,
    severity: entry.level === 'warn' ? 'warning' : 'error',
    occurredAt: entry.occurredAt
  }));

  const status = {
    service: 'online',
    aiProvider,
    usesMiniMax,
    usesOpenAI,
    features: {
      speechToText: usesOpenAI ? 'available' : 'unavailable',
      textToSpeech: usesOpenAI || usesMiniMax ? 'available' : 'unavailable',
      llm: usesOpenAI || usesMiniMax ? 'available' : 'unavailable'
    },
    capabilities: [
      'Order management',
      'Inventory tracking',
      'Menu availability (86 items)',
      'Task management',
      'Audit logging'
    ],
    version: '1.0.0',
    voiceConversationMetrics: {
      liveCount: parsePositiveNumber(normalizedStats.active),
      totalCount: parsePositiveNumber(normalizedStats.total),
      successCount,
      failureCount,
      successRate: Number((successCount / successDenominator).toFixed(4)),
      failureRate: Number((failureCount / successDenominator).toFixed(4)),
      averageMessagesPerConversation: parsePositiveNumber(normalizedStats.avgMessages)
    },
    incidents: [...recentIncidentsFromConversations, ...recentIncidentsFromLogs].slice(0, 10),
    probes: [
      {
        name: 'assistant-service',
        status: 'healthy',
        checkedAt: new Date().toISOString(),
        details: {
          aiProvider,
          configuredProviders: {
            miniMax: usesMiniMax,
            openAI: usesOpenAI
          }
        }
      },
      {
        name: 'voice-conversations',
        status: restaurantId ? 'healthy' : 'unknown',
        checkedAt: new Date().toISOString(),
        details: {
          restaurantId: restaurantId || 'unknown',
          liveCount: parsePositiveNumber(normalizedStats.active)
        }
      }
    ]
  };

  res.json({
    success: true,
    data: status
  });
}));

/**
 * GET /api/assistant/conversation
 * Get conversation history for a user (if we implement conversation storage)
 */
router.get('/conversation', asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.id;

  if (!userId) {
    throw new UnauthorizedError();
  }

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
 * DELETE /api/assistant/conversation
 * Clear conversation history for a user
 */
router.delete('/conversation', asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.id;

  if (!userId) {
    throw new UnauthorizedError();
  }

  // For now, just return success - this could clear stored conversation history
  logger.info(`Conversation history cleared for user ${userId}`);

  res.json({
    success: true,
    message: 'Conversation history cleared'
  });
}));

/**
 * POST /api/assistant/feedback
 * Submit feedback about assistant responses
 */
router.post('/feedback', asyncHandler(async (req: Request, res: Response) => {
  const { messageId, rating, comment } = req.body;
  const userId = req.user?.id;

  if (!userId) {
    throw new UnauthorizedError();
  }

  if (!messageId || rating === undefined) {
    return res.status(400).json({
      success: false,
      error: { message: 'messageId and rating are required' }
    });
  }

  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw new BadRequestError('rating must be an integer between 1 and 5');
  }

  if (comment !== undefined && (typeof comment !== 'string' || comment.length > 500)) {
    throw new BadRequestError('comment must be a string up to 500 characters');
  }

  // Log feedback for analysis
  logger.info('Assistant feedback received:', {
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
router.get('/tools', asyncHandler(async (req: Request, res: Response) => {
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
router.use((error: any, req: Request, res: Response, next: any) => {
  if (error instanceof multer.MulterError) {
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

export default router;
