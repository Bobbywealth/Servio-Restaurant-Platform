import { requireVapiWebhookAuth } from './vapiAuth';

function createRes() {
  return {} as any;
}

function runMiddleware(req: any) {
  return new Promise<Error | null>((resolve) => {
    requireVapiWebhookAuth(req as any, createRes(), (err?: Error) => resolve(err || null));
  });
}

describe('requireVapiWebhookAuth', () => {
  const oldEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...oldEnv };
    jest.restoreAllMocks();
  });

  it('allows in production when webhook secret is missing but bearer api key matches', async () => {
    process.env.NODE_ENV = 'production';
    delete process.env.VAPI_WEBHOOK_SECRET;
    process.env.VAPI_API_KEY = 'api_key_123';

    const err = await runMiddleware({
      headers: {
        authorization: 'Bearer api_key_123'
      }
    });

    expect(err).toBeNull();
  });

  it('rejects in production when no webhook credentials are configured', async () => {
    process.env.NODE_ENV = 'production';
    delete process.env.VAPI_WEBHOOK_SECRET;
    delete process.env.VAPI_API_KEY;

    const err = await runMiddleware({ headers: {} });

    expect(err).toBeTruthy();
    expect((err as Error).message).toContain('credentials not configured');
  });

  it('allows when x-vapi-secret matches configured webhook secret', async () => {
    process.env.NODE_ENV = 'production';
    process.env.VAPI_WEBHOOK_SECRET = 'secret_123';
    process.env.VAPI_API_KEY = 'api_key_123';

    const err = await runMiddleware({
      headers: {
        'x-vapi-secret': 'secret_123'
      }
    });

    expect(err).toBeNull();
  });
});
