import express from 'express';
import { errorHandler } from '../middleware/errorHandler';

const listConversationsMock = jest.fn();
const getMessagesMock = jest.fn();
const getMessageCountMock = jest.fn();
const deleteConversationMock = jest.fn();
const updateConversationStatusMock = jest.fn();
const getStatisticsMock = jest.fn();


jest.mock('../services/DatabaseService', () => ({
  DatabaseService: {
    getInstance: () => ({
      getDatabase: jest.fn(),
      logAudit: jest.fn()
    })
  }
}));
jest.mock('../services/AssistantService', () => ({
  AssistantService: jest.fn().mockImplementation(() => ({
    processAudio: jest.fn(),
    processText: jest.fn(),
    processTextStream: jest.fn()
  }))
}));

jest.mock('../services/VoiceConversationService', () => ({
  VoiceConversationService: {
    getInstance: () => ({
      listConversations: listConversationsMock,
      getMessages: getMessagesMock,
      getMessageCount: getMessageCountMock,
      deleteConversation: deleteConversationMock,
      updateConversationStatus: updateConversationStatusMock,
      getStatistics: getStatisticsMock
    })
  }
}));

describe('assistant conversation endpoints', () => {
  const createApp = async () => {
    const { default: assistantRoutes } = await import('./assistant');
    const app = express();

    app.use((req, _res, next) => {
      req.user = {
        id: 'user-1',
        restaurantId: 'rest-1',
        name: 'User One',
        role: 'admin',
        email: 'user1@example.com',
        permissions: []
      };
      next();
    });

    app.use('/api/assistant', assistantRoutes);
    app.use(errorHandler);

    return app;
  };

  beforeEach(() => {
    jest.resetAllMocks();

    listConversationsMock.mockResolvedValue({
      conversations: [
        {
          id: 'conv-1',
          session_id: 'sess-1',
          status: 'active',
          started_at: new Date('2025-01-01T00:00:00.000Z'),
          last_activity_at: new Date('2025-01-01T00:01:00.000Z'),
          ended_at: null,
          metadata: { userId: 'user-1' }
        },
        {
          id: 'conv-2',
          session_id: 'sess-2',
          status: 'completed',
          started_at: new Date('2025-01-01T00:02:00.000Z'),
          last_activity_at: new Date('2025-01-01T00:03:00.000Z'),
          ended_at: null,
          metadata: { userId: 'user-2' }
        }
      ],
      total: 2
    });

    getMessagesMock.mockResolvedValue([
      {
        id: 'msg-1',
        role: 'user',
        content: 'hello',
        audio_url: null,
        metadata: {},
        created_at: new Date('2025-01-01T00:00:01.000Z')
      }
    ]);

    getMessageCountMock.mockResolvedValue(1);
    deleteConversationMock.mockResolvedValue(true);
    updateConversationStatusMock.mockResolvedValue(undefined);
    getStatisticsMock.mockResolvedValue({ total: 0, active: 0, completed: 0, abandoned: 0, avgMessages: 0 });
  });

  it('returns real user-scoped conversation data for GET /conversation/:userId', async () => {
    const app = await createApp();
    const server = app.listen(0);
    const { port } = server.address() as { port: number };

    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/assistant/conversation/user-1`);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(listConversationsMock).toHaveBeenCalledWith('rest-1', { limit: 100, offset: 0 });
      expect(body.data.totalCount).toBe(1);
      expect(body.data.conversations).toHaveLength(1);
      expect(body.data.conversations[0]).toMatchObject({
        id: 'conv-1',
        sessionId: 'sess-1',
        messageCount: 1
      });
      expect(body.data.conversations[0].messages).toHaveLength(1);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it('archives user-scoped conversations for DELETE /conversation/:userId?action=archive', async () => {
    const app = await createApp();
    const server = app.listen(0);
    const { port } = server.address() as { port: number };

    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/assistant/conversation/user-1?action=archive`, {
        method: 'DELETE'
      });
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(updateConversationStatusMock).toHaveBeenCalledWith('conv-1', 'abandoned');
      expect(body.data).toEqual({
        action: 'archive',
        affectedConversations: 1,
        affectedMessages: 1
      });
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it('forbids users from reading another user\'s conversation history', async () => {
    const app = await createApp();
    const server = app.listen(0);
    const { port } = server.address() as { port: number };

    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/assistant/conversation/user-2`);
      const body = await response.json();

      expect(response.status).toBe(403);
      expect(body.error.message).toContain('own conversation history');
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});
