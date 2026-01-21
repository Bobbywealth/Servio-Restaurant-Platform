import { Router, Request, Response } from 'express';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import { AssistantService } from '../services/AssistantService';
import { MonitoringService } from '../services/MonitoringService';
import { logger } from '../utils/logger';
import { asyncHandler, UnauthorizedError } from '../middleware/errorHandler';
import { 
  requestSizeLimit,
  validateAudioContentType,
  validateTextContentType,
  securityLogger,
  validateAssistantPermissions
} from '../middleware/security';

const router = Router();

// Apply security middleware to all assistant routes
router.use(securityLogger);
router.use(validateAssistantPermissions);

// Rate limiting for assistant endpoints
const assistantRateLimit = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
  max: parseInt(process.env.ASSISTANT_RATE_LIMIT_MAX || '20'), // limit each IP to 20 requests per windowMs
  message: {
    success: false,
    error: {
      message: 'Too many assistant requests, please try again later.',
      type: 'RateLimitError',
      statusCode: 429
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Configure multer for audio file uploads with production-ready settings
const getMaxFileSize = () => {
  const size = process.env.MAX_AUDIO_FILE_SIZE || '25MB';
  const match = size.match(/^(\d+)(MB|KB)$/i);
  if (!match) return 25 * 1024 * 1024; // default 25MB
  
  const value = parseInt(match[1]);
  const unit = match[2].toUpperCase();
  return unit === 'MB' ? value * 1024 * 1024 : value * 1024;
};

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: getMaxFileSize(),
  },
  fileFilter: (req, file, cb: any) => {
    // Accept audio files
    const allowedMimeTypes = [
      'audio/wav',
      'audio/mpeg', 
      'audio/mp4',
      'audio/ogg',
      'audio/webm',
      'audio/flac',
      'audio/aac'
    ];
    
    if (allowedMimeTypes.some(type => file.mimetype.includes(type))) {
      cb(null, true);
    } else {
      cb(new Error('Only supported audio files are allowed (WAV, MP3, MP4, OGG, WebM, FLAC, AAC)'), false);
    }
  }
});

// Initialize services lazily to avoid database connection issues
let assistantService: AssistantService | null = null;
let monitoringService: MonitoringService | null = null;

const getAssistantService = () => {
  if (!assistantService) {
    assistantService = new AssistantService();
  }
  return assistantService;
};

const getMonitoringService = () => {
  if (!monitoringService) {
    monitoringService = MonitoringService.getInstance();
  }
  return monitoringService;
};

/**
 * POST /api/assistant/process-audio
 * Process audio input from microphone
 */
router.post('/process-audio', assistantRateLimit, upload.single('audio'), asyncHandler(async (req: Request, res: Response) => {
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
    const result = await getAssistantService().processAudio(audioFile.buffer, userId);

    // Record metrics for monitoring
    getMonitoringService().recordRequest('audio', result.processingTime, true);

    // Log successful processing for monitoring
    logger.info('Audio processed successfully', {
      userId,
      audioSize: audioFile.size,
      processingTime: result.processingTime,
      hasTranscript: !!result.transcript,
      actionCount: result.actions?.length || 0
    });

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    // Record error for monitoring
    const errorType = error instanceof Error ? error.constructor.name : 'UnknownError';
    getMonitoringService().recordError(errorType, { userId, audioSize: audioFile.size });
    getMonitoringService().recordRequest('audio', 0, false);

    logger.error('Audio processing error:', {
      userId,
      audioSize: audioFile.size,
      audioType: audioFile.mimetype,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });

    // Return appropriate error based on error type
    if (error instanceof Error) {
      if (error.message.includes('API key')) {
        res.status(503).json({
          success: false,
          error: {
            message: 'Assistant service temporarily unavailable',
            type: 'ServiceUnavailable'
          }
        });
      } else if (error.message.includes('rate limit')) {
        res.status(429).json({
          success: false,
          error: {
            message: 'Too many requests to AI service',
            type: 'RateLimited'
          }
        });
      } else {
        res.status(500).json({
          success: false,
          error: {
            message: 'Failed to process audio',
            type: 'ProcessingError',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
          }
        });
      }
    } else {
      res.status(500).json({
        success: false,
        error: {
          message: 'An unexpected error occurred',
          type: 'UnknownError'
        }
      });
    }
  }
}));

/**
 * POST /api/assistant/process-text
 * Process text input (from quick commands or typed input)
 */
router.post('/process-text', 
  assistantRateLimit, 
  validateTextContentType,
  asyncHandler(async (req: Request, res: Response) => {
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
    const result = await getAssistantService().processText(text, userId);

    // Record metrics for monitoring
    getMonitoringService().recordRequest('text', result.processingTime, true);

    // Log successful processing for monitoring
    logger.info('Text processed successfully', {
      userId,
      textLength: text.length,
      processingTime: result.processingTime,
      actionCount: result.actions?.length || 0
    });

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    // Record error for monitoring
    const errorType = error instanceof Error ? error.constructor.name : 'UnknownError';
    getMonitoringService().recordError(errorType, { userId, textLength: text.length });
    getMonitoringService().recordRequest('text', 0, false);

    logger.error('Text processing error:', {
      userId,
      textLength: text.length,
      textPreview: text.substring(0, 100),
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });

    // Return appropriate error based on error type
    if (error instanceof Error) {
      if (error.message.includes('API key')) {
        res.status(503).json({
          success: false,
          error: {
            message: 'Assistant service temporarily unavailable',
            type: 'ServiceUnavailable'
          }
        });
      } else if (error.message.includes('rate limit')) {
        res.status(429).json({
          success: false,
          error: {
            message: 'Too many requests to AI service',
            type: 'RateLimited'
          }
        });
      } else {
        res.status(500).json({
          success: false,
          error: {
            message: 'Failed to process text',
            type: 'ProcessingError',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
          }
        });
      }
    } else {
      res.status(500).json({
        success: false,
        error: {
          message: 'An unexpected error occurred',
          type: 'UnknownError'
        }
      });
    }
  }
}));

/**
 * GET /api/assistant/status
 * Get assistant service status and configuration
 */
router.get('/status', asyncHandler(async (req: Request, res: Response) => {
  const healthStatus = getMonitoringService().getHealthStatus();
  
  const status = {
    service: 'online',
    environment: process.env.NODE_ENV || 'development',
    health: healthStatus.status,
    features: {
      speechToText: process.env.OPENAI_API_KEY ? 'available' : 'unavailable',
      textToSpeech: process.env.OPENAI_API_KEY || process.env.ELEVENLABS_API_KEY ? 'available' : 'unavailable',
      llm: process.env.OPENAI_API_KEY ? 'available' : 'unavailable',
      wakeWord: process.env.ASSISTANT_WAKE_WORD_ENABLED === 'true' ? 'enabled' : 'disabled',
      phoneIntegration: process.env.VAPI_API_KEY ? 'available' : 'unavailable'
    },
    capabilities: [
      'Order management',
      'Inventory tracking', 
      'Menu availability (86 items)',
      'Task management',
      'Audit logging',
      'Voice recognition',
      'Natural language processing',
      'Phone call handling'
    ],
    configuration: {
      maxAudioFileSize: process.env.MAX_AUDIO_FILE_SIZE || '25MB',
      conversationTimeout: process.env.ASSISTANT_CONVERSATION_TIMEOUT || '1800000',
      maxHistoryLength: process.env.ASSISTANT_MAX_HISTORY_LENGTH || '50',
      defaultLanguage: process.env.ASSISTANT_DEFAULT_LANGUAGE || 'en',
      ttsModel: process.env.OPENAI_TTS_MODEL || 'tts-1',
      ttsVoice: process.env.OPENAI_TTS_VOICE || 'alloy',
      rateLimitMax: process.env.ASSISTANT_RATE_LIMIT_MAX || '20'
    },
    metrics: healthStatus.metrics,
    healthChecks: healthStatus.checks,
    systemHealth: {
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      timestamp: new Date().toISOString(),
      nodeVersion: process.version,
      platform: process.platform
    },
    version: '1.1.0'
  };

  res.json({
    success: true,
    data: status
  });
}));

/**
 * GET /api/assistant/health
 * Detailed health check endpoint for monitoring systems
 */
router.get('/health', asyncHandler(async (req: Request, res: Response) => {
  const healthStatus = getMonitoringService().getHealthStatus();
  const report = getMonitoringService().generateReport();

  res.status(healthStatus.status === 'healthy' ? 200 : 
    healthStatus.status === 'degraded' ? 200 : 503)
    .json({
      status: healthStatus.status,
      timestamp: new Date().toISOString(),
      service: 'servio-assistant',
      version: '1.1.0',
      checks: healthStatus.checks,
      metrics: healthStatus.metrics,
      report: {
        summary: report.summary,
        recommendations: report.recommendations,
        alerts: report.alerts
      },
      uptime: process.uptime()
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
      permissions: ['orders:read']
    },
    {
      name: 'update_order_status',
      description: 'Update order status (received, preparing, ready, completed)',
      category: 'Orders',
      permissions: ['orders:write']
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

  if (error.message.includes('Only supported audio files are allowed')) {
    return res.status(400).json({
      success: false,
      error: { 
        message: 'Only supported audio files are accepted (WAV, MP3, MP4, OGG, WebM, FLAC, AAC).',
        type: 'UnsupportedFileType'
      }
    });
  }

  next(error);
});

export default router;