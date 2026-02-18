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
  all: jest.Mock;
  get: jest.Mock;
};

const mockedGetInstance = DatabaseService.getInstance as jest.Mock;

const createApp = () => {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).user = {
      id: 'platform-admin-1',
      role: 'platform-admin',
      permissions: ['*']
    };
    next();
  });

  app.use('/api/admin', adminRouter);
  return app;
};

const requestJson = async (app: express.Express, path: string) => {
  const server = app.listen(0);
  const { port } = server.address() as any;

  try {
    const response = await fetch(`http://127.0.0.1:${port}${path}`);
    const data = await response.json();
    return { status: response.status, data };
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
};

describe('admin KPI contract routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('GET /api/admin/platform-stats defines active orders and on-duty staff with live-state criteria', async () => {
    const db: MockDb = {
      all: jest
        .fn()
        .mockResolvedValueOnce([
          {
            total_restaurants: 2,
            active_orders_now: 7,
            staff_on_duty: 5,
            revenue_today: 420
          }
        ])
        .mockResolvedValueOnce([]),
      get: jest.fn()
    };

    mockedGetInstance.mockReturnValue({ getDatabase: jest.fn().mockResolvedValue(db) });

    const app = createApp();
    const result = await requestJson(app, '/api/admin/platform-stats');

    expect(result.status).toBe(200);
    expect(result.data.stats.active_orders_now).toBe(7);
    expect(result.data.stats.staff_on_duty).toBe(5);

    const statsSql = String(db.all.mock.calls[0][0]);
    expect(statsSql).toContain('active_orders_now');
    expect(statsSql).toContain("status IN ('pending', 'accepted', 'received', 'preparing', 'ready')");
    expect(statsSql).toContain('staff_on_duty');
    expect(statsSql).toContain('te.clock_out_time IS NULL');
  });

  it('GET /api/admin/restaurants exposes non-overloaded KPI fields for orders and staffing', async () => {
    const db: MockDb = {
      all: jest.fn().mockResolvedValueOnce([
        {
          id: 'r-1',
          name: 'North Kitchen',
          is_active: true,
          orders_today: 14,
          active_orders_now: 4,
          staff_total: 12,
          staff_on_duty: 3
        }
      ]),
      get: jest.fn().mockResolvedValue({ total: 1 })
    };

    mockedGetInstance.mockReturnValue({ getDatabase: jest.fn().mockResolvedValue(db) });

    const app = createApp();
    const result = await requestJson(app, '/api/admin/restaurants?limit=5&page=1');

    expect(result.status).toBe(200);
    expect(result.data.restaurants[0]).toMatchObject({
      orders_today: 14,
      active_orders_now: 4,
      staff_total: 12,
      staff_on_duty: 3
    });

    const restaurantsSql = String(db.all.mock.calls[0][0]);
    expect(restaurantsSql).toContain('orders_today');
    expect(restaurantsSql).toContain('active_orders_now');
    expect(restaurantsSql).toContain('staff_total');
    expect(restaurantsSql).toContain('staff_on_duty');
    expect(restaurantsSql).toContain('LEFT JOIN time_entries te');
  });
});
