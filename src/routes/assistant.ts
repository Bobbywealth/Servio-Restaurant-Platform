import { Router, Request, Response } from 'express';
import multer from 'multer';
import { AssistantService } from '../services/AssistantService';
import { logger } from '../utils/logger';
import { asyncHandler, UnauthorizedError } from '../middleware/errorHandler';

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
  const status = {
    service: 'online',
    features: {
      speechToText: process.env.OPENAI_API_KEY ? 'available' : 'unavailable',
      textToSpeech: process.env.OPENAI_API_KEY || process.env.ELEVENLABS_API_KEY ? 'available' : 'unavailable',
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
router.get('/conversation/:userId', asyncHandler(async (req: Request, res: Response) => {

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
router.delete('/conversation/:userId', asyncHandler(async (req: Request, res: Response) => {
  const { userId } = req.params;

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
  const { userId, messageId, rating, comment } = req.body;

  if (!userId || !messageId || rating === undefined) {
    return res.status(400).json({
      success: false,
      error: { message: 'userId, messageId, and rating are required' }
    });
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