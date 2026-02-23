import { test, expect } from '@playwright/test'

type StorageMap = Map<string, string>

function createJwt(expiryOffsetSeconds: number): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')
  const payload = Buffer.from(
    JSON.stringify({ exp: Math.floor(Date.now() / 1000) + expiryOffsetSeconds })
  ).toString('base64url')
  return `${header}.${payload}.sig`
}

function installBrowserLikeGlobals(storage: StorageMap) {
  const localStorage = {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => {
      storage.set(key, value)
    },
    removeItem: (key: string) => {
      storage.delete(key)
    }
  }

  const windowLike = {
    location: { pathname: '/dashboard', href: '' },
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    localStorage
  }

  Object.defineProperty(globalThis, 'window', { value: windowLike, configurable: true })
  Object.defineProperty(globalThis, 'localStorage', { value: localStorage, configurable: true })
  Object.defineProperty(globalThis, 'navigator', {
    value: { onLine: true },
    configurable: true
  })
}

test.describe('centralized token refresh', () => {
  test('idle -> activity refresh + next API request performs a single refresh call', async () => {
    process.env.NEXT_PUBLIC_API_URL = 'http://localhost:3002'

    const storage = new Map<string, string>()
    storage.set('servio_access_token', createJwt(-60))
    storage.set('servio_refresh_token', 'refresh-token')
    installBrowserLikeGlobals(storage)

    const { api, refreshAccessToken, __apiTestUtils } = require('../lib/api')

    let refreshCalls = 0
    let apiCalls = 0

    __apiTestUtils.resetState()
    __apiTestUtils.setRefreshAdapter(async (config: any) => {
      refreshCalls += 1
      expect(config.url).toBe('/api/auth/refresh')
      return {
        data: { data: { accessToken: createJwt(3600) } },
        status: 200,
        statusText: 'OK',
        headers: {},
        config
      }
    })

    __apiTestUtils.setApiAdapter(async (config: any) => {
      apiCalls += 1
      expect(config.headers.Authorization).toContain('Bearer ')
      return {
        data: { ok: true },
        status: 200,
        statusText: 'OK',
        headers: {},
        config
      }
    })

    const activityRefreshResult = await refreshAccessToken()
    expect(activityRefreshResult).toBeTruthy()

    await api.get('/api/orders')

    expect(apiCalls).toBe(1)
    expect(refreshCalls).toBe(1)
  })
})
