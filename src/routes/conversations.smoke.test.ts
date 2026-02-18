import express from 'express';

jest.mock('uuid', () => ({
  v4: () => 'req-1'
}));

type ListSessionsResult = {
  sessions: unknown[];
  total: number;
};

const listSessionsMock = jest.fn<Promise<ListSessionsResult>, [string, unknown]>();
const getAnalyticsSummaryMock = jest.fn<Promise<Record<string, unknown>>, [string, Date | undefined, Date | undefined]>();

jest.mock('../services/DatabaseService', () => ({
  DatabaseService: {
    getInstance: () => ({
      logAudit: jest.fn()
    })
  }
}));

jest.mock('../services/ConversationService', () => ({
  ConversationService: {
    getInstance: () => ({
      listSessions: listSessionsMock,
      getAnalyticsSummary: getAnalyticsSummaryMock
    })
  }
}));

describe('conversations route mounting smoke test', () => {
  beforeEach(() => {
    listSessionsMock.mockReset();
    getAnalyticsSummaryMock.mockReset();

    listSessionsMock.mockResolvedValue({ sessions: [], total: 0 });
    getAnalyticsSummaryMock.mockResolvedValue({ totalCalls: 0 });
  });

  it('does not return 404 for authenticated GET /api/conversations', async () => {
    const { default: conversationsRoutes } = await import('./conversations');

    const app = express();

    const requireAuth = (req: express.Request, _res: express.Response, next: express.NextFunction) => {
      req.user = {
        id: 'user-1',
        restaurantId: 'rest-1',
        name: 'Test User',
        role: 'admin',
        email: 'test@example.com',
        permissions: []
      };
      next();
    };

    app.use('/api/conversations', requireAuth, conversationsRoutes);

    const server = app.listen(0);
    const { port } = server.address() as { port: number };

    try {
      const listResponse = await fetch(`http://127.0.0.1:${port}/api/conversations`);
      expect(listResponse.status).not.toBe(404);
      expect(listResponse.status).toBe(200);
      expect(listSessionsMock).toHaveBeenCalledWith(
        'rest-1',
        expect.objectContaining({ limit: 50, offset: 0 })
      );

      const analyticsResponse = await fetch(`http://127.0.0.1:${port}/api/conversations/analytics/summary`);
      expect(analyticsResponse.status).toBe(200);
      expect(getAnalyticsSummaryMock).toHaveBeenCalledWith('rest-1', undefined, undefined);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});
