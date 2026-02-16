import { buildSystemHealthPayload } from '../../routes/systemHealth';

describe('buildSystemHealthPayload', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetAllMocks();
    process.env = { ...originalEnv };
    delete process.env.HEALTHCHECK_OPTIONAL_URLS;
    process.env.FRONTEND_URL = 'https://frontend.example.com';
    process.env.BACKEND_URL = 'https://api.example.com';
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  const createDb = (failedCount: number, recentErrors: any[] = [], storageErrors: any[] = []) => ({
    get: jest.fn().mockResolvedValue({ count: failedCount }),
    all: jest
      .fn()
      .mockResolvedValueOnce(recentErrors)
      .mockResolvedValueOnce(storageErrors)
  });

  it('returns operational status when probes and metrics are healthy', async () => {
    const db = createDb(0, [], []);
    const fetchMock = jest.fn().mockResolvedValue({ ok: true, status: 200 });

    const payload = await buildSystemHealthPayload({
      db,
      requestProtocol: 'https',
      requestHost: 'admin.example.com',
      fetchImpl: fetchMock as unknown as typeof fetch,
      now: () => new Date('2026-01-01T00:00:00.000Z')
    });

    expect(payload.status).toBe('operational');
    expect(payload.services).toHaveLength(2);
    expect(payload.services.every((service) => service.status === 'operational')).toBe(true);
    expect(payload.failedJobs).toBe(0);
    expect(payload.recentErrors).toHaveLength(0);
  });

  it('marks health as down when critical API probe times out', async () => {
    const db = createDb(0, [], []);
    const fetchMock = jest.fn((url: string, init?: RequestInit) => {
      if (url.includes('/health')) {
        return new Promise((_, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
        });
      }

      return Promise.resolve({ ok: true, status: 200 });
    });

    const payload = await buildSystemHealthPayload({
      db,
      requestProtocol: 'https',
      requestHost: 'admin.example.com',
      fetchImpl: fetchMock as unknown as typeof fetch,
      timeoutMs: 25,
      now: () => new Date('2026-01-01T00:00:00.000Z')
    });

    const apiProbe = payload.services.find((service) => service.name === 'API health');
    expect(apiProbe?.status).toBe('down');
    expect(apiProbe?.error).toContain('timed out');
    expect(payload.status).toBe('down');
  });

  it('returns degraded status for optional dependency outage while core services remain operational', async () => {
    process.env.HEALTHCHECK_OPTIONAL_URLS = 'Maps API|https://maps.example.com/health';

    const db = createDb(0, [{ action: 'error event', created_at: '2026-01-01T00:00:00.000Z' }], []);
    const fetchMock = jest.fn((url: string) => {
      if (url.includes('maps.example.com')) {
        return Promise.resolve({ ok: false, status: 503 });
      }
      return Promise.resolve({ ok: true, status: 200 });
    });

    const payload = await buildSystemHealthPayload({
      db,
      requestProtocol: 'https',
      requestHost: 'admin.example.com',
      fetchImpl: fetchMock as unknown as typeof fetch,
      now: () => new Date('2026-01-01T00:00:00.000Z')
    });

    const optionalProbe = payload.services.find((service) => service.name === 'Maps API');
    expect(optionalProbe?.optional).toBe(true);
    expect(optionalProbe?.status).toBe('degraded');
    expect(payload.status).toBe('degraded');
    expect(payload.recentErrors).toHaveLength(1);
  });
});
