import express from 'express';
import adminRouter from './admin';
import { DatabaseService } from '../services/DatabaseService';

jest.mock('../services/DatabaseService', () => ({
  DatabaseService: {
    getInstance: jest.fn()
  }
}));

jest.mock('uuid', () => ({
  v4: jest.fn(() => 'audit-log-id')
}));

type MockDb = {
  get: jest.Mock;
  run: jest.Mock;
};

const mockedGetInstance = DatabaseService.getInstance as jest.Mock;

const createApp = (withUser = true) => {
  const app = express();
  app.use(express.json());

  if (withUser) {
    app.use((req, _res, next) => {
      (req as any).user = {
        id: 'platform-admin-1',
        restaurantId: 'admin-restaurant',
        name: 'Platform Admin',
        role: 'platform-admin',
        permissions: []
      };
      next();
    });
  }

  app.use('/api/admin', adminRouter);
  return app;
};

const requestJson = async (app: express.Express, path: string, body?: unknown, method = 'PATCH') => {
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

describe('PATCH /api/admin/restaurants/:id/status', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 401 when request is unauthenticated', async () => {
    const db: MockDb = {
      get: jest.fn(),
      run: jest.fn()
    };
    mockedGetInstance.mockReturnValue({ getDatabase: jest.fn().mockResolvedValue(db) });

    const app = createApp(false);
    const result = await requestJson(app, '/api/admin/restaurants/restaurant-1/status', { status: 'inactive' });

    expect(result.status).toBe(401);
    expect(result.data.error).toBe('Authentication required');
    expect(db.get).not.toHaveBeenCalled();
  });

  it('returns 404 when restaurant does not exist', async () => {
    const db: MockDb = {
      get: jest.fn().mockResolvedValue(undefined),
      run: jest.fn()
    };
    mockedGetInstance.mockReturnValue({ getDatabase: jest.fn().mockResolvedValue(db) });

    const app = createApp(true);
    const result = await requestJson(app, '/api/admin/restaurants/missing-id/status', { status: 'inactive' });

    expect(result.status).toBe(404);
    expect(result.data.error).toBe('Restaurant not found');
    expect(db.run).not.toHaveBeenCalled();
  });

  it('deactivates restaurant and writes an audit event', async () => {
    const db: MockDb = {
      get: jest
        .fn()
        .mockResolvedValueOnce({ id: 'rest-1', name: 'Downtown', is_active: true })
        .mockResolvedValueOnce({ total: 2 })
        .mockResolvedValueOnce({ exists: 1 }),
      run: jest
        .fn()
        .mockResolvedValueOnce({ changes: 1 })
        .mockResolvedValueOnce({ changes: 3 })
        .mockResolvedValueOnce({ changes: 2 })
        .mockResolvedValueOnce({ changes: 1 })
    };
    mockedGetInstance.mockReturnValue({ getDatabase: jest.fn().mockResolvedValue(db) });

    const app = createApp(true);
    const result = await requestJson(app, '/api/admin/restaurants/rest-1/status', { status: 'inactive' });

    expect(result.status).toBe(200);
    expect(result.data.message).toBe('Restaurant deactivated successfully');
    expect(result.data.restaurant).toEqual({ id: 'rest-1', is_active: false });
    expect(result.data.relatedUpdates).toEqual({
      usersUpdated: 3,
      campaignsUpdated: 2,
      ordersRetained: true
    });

    expect(db.run).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE restaurants SET is_active = ?'),
      [false, 'rest-1']
    );
    expect(db.run).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO audit_logs'),
      expect.arrayContaining(['audit-log-id', 'rest-1', 'platform-admin-1', 'restaurant.deactivated'])
    );
  });
});
