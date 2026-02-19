import express from 'express';
import assistantRouter from './assistant';
import { errorHandler, notFoundHandler } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

jest.mock('../services/AssistantService', () => ({
  AssistantService: jest.fn().mockImplementation(() => ({
    processAudio: jest.fn(),
    processText: jest.fn(),
    processTextStream: jest.fn()
  }))
}));

jest.mock('../services/VoiceConversationService', () => ({
  VoiceConversationService: {
    getInstance: jest.fn(() => ({
      getStatistics: jest.fn().mockResolvedValue({
        total: 0,
        active: 0,
        completed: 0,
        abandoned: 0,
        avgMessages: 0
      })
    }))
  }
}));

jest.mock('../services/DatabaseService', () => ({
  DatabaseService: {
    getInstance: jest.fn(() => ({
      getDatabase: jest.fn(() => ({
        all: jest.fn().mockResolvedValue([])
      }))
    }))
  }
}));

jest.mock('../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

const createApp = (userId?: string) => {
  const app = express();
  app.use(express.json());

  app.use((req, _res, next) => {
    if (userId) {
      (req as any).user = { id: userId };
    }
    next();
  });

  app.use('/api/assistant', assistantRouter);
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};

const requestJson = async (
  app: express.Express,
  path: string,
  method = 'GET',
  body?: unknown
) => {
  const server = app.listen(0);
  const { port } = server.address() as any;

  try {
    const response = await fetch(`http://127.0.0.1:${port}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json'
      },
      body: body ? JSON.stringify(body) : undefined
    });

    const data = await response.json();
    return { status: response.status, data };
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
};

describe('assistant routes auth-scoped user handling', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('ignores userId from feedback request body and uses authenticated identity', async () => {
    const app = createApp('authenticated-user');

    const result = await requestJson(app, '/api/assistant/feedback', 'POST', {
      userId: 'spoofed-user',
      messageId: 'message-1',
      rating: 5,
      comment: 'Great answer'
    });

    expect(result.status).toBe(200);
    expect(result.data.success).toBe(true);
    expect(logger.info).toHaveBeenCalledWith(
      'Assistant feedback received:',
      expect.objectContaining({
        userId: 'authenticated-user',
        messageId: 'message-1',
        rating: 5,
        comment: 'Great answer'
      })
    );
  });

  it('uses authenticated user identity for conversation operations', async () => {
    const app = createApp('conversation-owner');

    const result = await requestJson(app, '/api/assistant/conversation', 'DELETE');

    expect(result.status).toBe(200);
    expect(result.data.success).toBe(true);
    expect(logger.info).toHaveBeenCalledWith('Conversation history cleared for user conversation-owner');
  });

  it('does not allow userId in conversation route path', async () => {
    const app = createApp('conversation-owner');

    const result = await requestJson(app, '/api/assistant/conversation/spoofed-user', 'GET');

    expect(result.status).toBe(404);
  });

  it('rejects unauthenticated feedback and conversation requests', async () => {
    const app = createApp();

    const feedbackResult = await requestJson(app, '/api/assistant/feedback', 'POST', {
      messageId: 'message-1',
      rating: 4
    });
    expect(feedbackResult.status).toBe(401);

    const conversationResult = await requestJson(app, '/api/assistant/conversation', 'GET');
    expect(conversationResult.status).toBe(401);
  });
});
