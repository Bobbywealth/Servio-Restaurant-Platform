import express from 'express';
import adminRouter from './admin';
import { DatabaseService } from '../services/DatabaseService';

jest.mock('../services/DatabaseService', () => ({
  DatabaseService: {
    getInstance: jest.fn()
  }
}));


jest.mock('uuid', () => ({
  v4: jest.fn(() => 'mock-uuid')
}));
type MockDb = {
  get: jest.Mock;
  all: jest.Mock;
  run: jest.Mock;
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

describe('admin task rollout routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('POST /api/admin/tasks creates one task per active restaurant for scope=company', async () => {
    const db: MockDb = {
      get: jest.fn(),
      all: jest.fn().mockResolvedValue([{ id: 'rest-1' }, { id: 'rest-2' }]),
      run: jest.fn().mockResolvedValue({ changes: 1 })
    };

    mockedGetInstance.mockReturnValue({ getDatabase: jest.fn().mockResolvedValue(db) });

    const app = createApp();
    const result = await requestJson(app, '/api/admin/tasks', 'POST', {
      scope: 'company',
      company_id: 'comp-1',
      title: 'Roll out new SOP'
    });

    expect(result.status).toBe(201);
    expect(result.data.scope).toBe('company');
    expect(result.data.created_count).toBe(2);
    expect(typeof result.data.parent_task_group_id).toBe('string');
    expect(result.data.task_ids).toHaveLength(2);
    expect(db.run).toHaveBeenCalledTimes(2);
  });

  it('PATCH /api/admin/tasks/:id updates all grouped tasks when apply_to_group=true', async () => {
    const db: MockDb = {
      get: jest
        .fn()
        .mockResolvedValueOnce({ id: 'task-id-1', restaurant_id: 'rest-1', status: 'pending', parent_task_group_id: 'group-1' })
        .mockResolvedValueOnce({
          id: 'task-id-1',
          restaurant_id: 'rest-1',
          parent_task_group_id: 'group-1',
          restaurant_name: 'Alpha',
          title: 'Task',
          description: null,
          status: 'completed',
          priority: 'medium',
          type: 'one_time',
          assigned_to: null,
          assigned_to_name: null,
          due_date: null,
          completed_at: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }),
      all: jest.fn(),
      run: jest.fn().mockResolvedValue({ changes: 2 })
    };

    mockedGetInstance.mockReturnValue({ getDatabase: jest.fn().mockResolvedValue(db) });

    const app = createApp();
    const result = await requestJson(app, '/api/admin/tasks/task-id-1', 'PATCH', {
      status: 'completed',
      apply_to_group: true
    });

    expect(result.status).toBe(200);
    expect(result.data.applied_to_group).toBe(true);
    expect(db.run).toHaveBeenCalledWith(expect.stringContaining('WHERE parent_task_group_id = ?'), expect.any(Array));
  });

  it('DELETE /api/admin/tasks/:id?applyToGroup=true deletes all grouped tasks', async () => {
    const db: MockDb = {
      get: jest.fn().mockResolvedValue({ id: 'task-id-1', parent_task_group_id: 'group-1' }),
      all: jest.fn(),
      run: jest.fn().mockResolvedValue({ changes: 3 })
    };

    mockedGetInstance.mockReturnValue({ getDatabase: jest.fn().mockResolvedValue(db) });

    const app = createApp();
    const result = await requestJson(app, '/api/admin/tasks/task-id-1?applyToGroup=true', 'DELETE');

    expect(result.status).toBe(200);
    expect(result.data).toMatchObject({ success: true, deleted_count: 3, applied_to_group: true });
    expect(db.run).toHaveBeenCalledWith('DELETE FROM tasks WHERE parent_task_group_id = ?', ['group-1']);
  });
});
