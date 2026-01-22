import { getCorsOrigins } from './validateEnv';

describe('getCorsOrigins', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.FRONTEND_URL;
    delete process.env.ALLOWED_ORIGINS;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('falls back to localhost when unset', () => {
    expect(getCorsOrigins()).toEqual(['http://localhost:3000']);
  });

  it('uses FRONTEND_URL when set', () => {
    process.env.FRONTEND_URL = 'https://example.com';
    expect(getCorsOrigins()).toEqual(['https://example.com']);
  });

  it('adds ALLOWED_ORIGINS (comma-separated)', () => {
    process.env.FRONTEND_URL = 'https://example.com';
    process.env.ALLOWED_ORIGINS = 'https://a.com, https://b.com';
    expect(getCorsOrigins()).toEqual(['https://example.com', 'https://a.com', 'https://b.com']);
  });
});

