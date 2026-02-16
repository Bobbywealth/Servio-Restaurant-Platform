import express from 'express';
import { AddressInfo } from 'net';

const mockDb = {
  all: jest.fn(),
  get: jest.fn()
};

jest.mock('../../services/DatabaseService', () => ({
  DatabaseService: {
    getInstance: () => ({
      getDatabase: jest.fn().mockResolvedValue(mockDb)
    })
  }
}));

const createApp = async () => {
  const adminRouter = (await import('../../routes/admin')).default;
  const app = express();
  app.use((req, _res, next) => {
    const role = req.header('x-test-role');
    if (role) {
      req.user = {
        id: 'user-1',
        restaurantId: 'rest-a',
        name: 'Test User',
        email: 'test@example.com',
        role: role as any,
        permissions: ['*']
      };
    }
    next();
  });
  app.use('/api/admin', adminRouter);
  return app;
};

const httpRequest = async (app: express.Express, path: string, init: RequestInit = {}) => {
  const server = app.listen(0);
  const { port } = server.address() as AddressInfo;

  try {
    return await fetch(`http://127.0.0.1:${port}${path}`, init);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
};

describe('Admin orders integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('lists orders across restaurants with restaurant_name', async () => {
    mockDb.all.mockResolvedValue([
      {
        id: 'order-1',
        restaurant_id: 'rest-a',
        restaurant_name: 'North Side Diner',
        status: 'pending',
        customer_name: 'Alex',
        customer_phone: '555-1000',
        total_amount: 19.95,
        source: 'web',
        created_at: '2026-01-01T12:00:00.000Z'
      },
      {
        id: 'order-2',
        restaurant_id: 'rest-b',
        restaurant_name: 'South Kitchen',
        status: 'completed',
        customer_name: 'Jamie',
        customer_phone: '555-2000',
        total_amount: 28.5,
        source: 'phone',
        created_at: '2026-01-01T11:00:00.000Z'
      }
    ]);
    mockDb.get.mockResolvedValue({ total: 2 });

    const app = await createApp();
    const response = await httpRequest(app, '/api/admin/orders?page=1&limit=2', {
      headers: { 'x-test-role': 'platform-admin' }
    });

    expect(response.status).toBe(200);
    const payload = await response.json();

    expect(payload.orders).toHaveLength(2);
    expect(payload.orders[0].restaurant_name).toBe('North Side Diner');
    expect(payload.orders[1].restaurant_name).toBe('South Kitchen');
    expect(payload.pagination.total).toBe(2);

    const [query] = mockDb.all.mock.calls[0];
    expect(query).toContain('LEFT JOIN restaurants r ON r.id = o.restaurant_id');
  });

  it('rejects non-admin users from admin orders endpoints', async () => {
    const app = await createApp();

    const unauthenticatedResponse = await httpRequest(app, '/api/admin/orders');
    expect(unauthenticatedResponse.status).toBe(401);

    const staffResponse = await httpRequest(app, '/api/admin/orders', {
      headers: { 'x-test-role': 'staff' }
    });
    expect(staffResponse.status).toBe(403);
  });
});
