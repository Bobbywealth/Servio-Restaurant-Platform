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
        role: 'platform-admin',
        permissions: ['*']
      };
      next();
    });
  }

  app.use('/api/admin', adminRouter);
  return app;
};

const requestJson = async (app: express.Express, path: string, method = 'GET', body?: unknown) => {
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

describe('admin settings routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('GET /api/admin/settings returns defaults when row missing', async () => {
    const db: MockDb = {
      get: jest.fn().mockResolvedValue(undefined),
      run: jest.fn()
    };

    mockedGetInstance.mockReturnValue({ getDatabase: jest.fn().mockResolvedValue(db) });

    const app = createApp(true);
    const result = await requestJson(app, '/api/admin/settings');

    expect(result.status).toBe(200);
    expect(result.data.success).toBe(true);
    expect(result.data.settings.maintenanceMode).toBe(false);
    expect(result.data.settings.defaultOrderPageSize).toBe(50);
  });

  it('GET /api/admin/settings falls back to defaults when stored JSON is malformed', async () => {
    const db: MockDb = {
      get: jest.fn().mockResolvedValue({ settings: '{not-valid-json' }),
      run: jest.fn()
    };

    mockedGetInstance.mockReturnValue({ getDatabase: jest.fn().mockResolvedValue(db) });

    const app = createApp(true);
    const result = await requestJson(app, '/api/admin/settings');

    expect(result.status).toBe(200);
    expect(result.data.success).toBe(true);
    expect(result.data.settings).toEqual({
      maintenanceMode: false,
      maintenanceMessage: 'Servio platform maintenance is in progress. Please check back shortly.',
      allowNewDemoBookings: true,
      defaultOrderPageSize: 50,
      alertEmail: 'ops@servio.solutions'
    });
  });

  it('PUT /api/admin/settings sanitizes and persists payload', async () => {
    const db: MockDb = {
      get: jest.fn(),
      run: jest.fn().mockResolvedValue({ changes: 1 })
    };

    mockedGetInstance.mockReturnValue({ getDatabase: jest.fn().mockResolvedValue(db) });

    const app = createApp(true);
    const result = await requestJson(app, '/api/admin/settings', 'PUT', {
      maintenanceMode: true,
      maintenanceMessage: '  Planned migration  ',
      allowNewDemoBookings: false,
      defaultOrderPageSize: 500,
      alertEmail: ''
    });

    expect(result.status).toBe(200);
    expect(result.data.success).toBe(true);
    expect(result.data.settings).toMatchObject({
      maintenanceMode: true,
      maintenanceMessage: 'Planned migration',
      allowNewDemoBookings: false,
      defaultOrderPageSize: 50,
      alertEmail: 'ops@servio.solutions'
    });

    expect(db.run).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO platform_settings'),
      [
        'default',
        JSON.stringify(result.data.settings),
        'platform-admin-1'
      ]
    );
  });
});
