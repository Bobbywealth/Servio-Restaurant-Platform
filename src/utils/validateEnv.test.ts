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
    expect(getCorsOrigins()).toEqual([
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:3003'
    ]);
  });

  it('uses provided default origin when unset', () => {
    expect(getCorsOrigins('https://servio-app.onrender.com')).toEqual([
      'https://servio-app.onrender.com',
      'http://servio-app.onrender.com'
    ]);
  });

  it('uses FRONTEND_URL when set', () => {
    process.env.FRONTEND_URL = 'https://example.com';
    expect(getCorsOrigins()).toEqual([
      'https://example.com',
      'http://example.com'
    ]);
  });

  it('adds ALLOWED_ORIGINS (comma-separated)', () => {
    process.env.FRONTEND_URL = 'https://example.com';
    process.env.ALLOWED_ORIGINS = 'https://a.com, https://b.com';
    expect(getCorsOrigins()).toEqual([
      'https://example.com',
      'http://example.com',
      'https://a.com',
      'http://a.com',
      'https://b.com',
      'http://b.com'
    ]);
  });
});
