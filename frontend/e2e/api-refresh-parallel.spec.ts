import { test, expect } from '@playwright/test'
import http from 'node:http'

test('reuses one refresh promise for parallel 401 responses and retries both requests', async () => {
  let refreshCallCount = 0

  const server = http.createServer((req, res) => {
    const auth = req.headers.authorization

    if (req.method === 'POST' && req.url === '/api/auth/refresh') {
      refreshCallCount += 1
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ data: { accessToken: 'new-access-token' } }))
      return
    }

    if (req.method === 'GET' && req.url === '/protected') {
      if (auth === 'Bearer new-access-token') {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ ok: true }))
        return
      }

      res.writeHead(401, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: { message: 'unauthorized' } }))
      return
    }

    res.writeHead(404)
    res.end()
  })

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()))
  const address = server.address()
  if (!address || typeof address === 'string') {
    server.close()
    throw new Error('Failed to acquire test server address')
  }

  const previousApiUrl = process.env.NEXT_PUBLIC_API_URL
  process.env.NEXT_PUBLIC_API_URL = `http://127.0.0.1:${address.port}`

  const storage = new Map<string, string>([['servio_refresh_token', 'refresh-token']])
  const locationState = { href: 'http://localhost/' }

  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      location: locationState,
      localStorage: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => {
          storage.set(key, value)
        },
        removeItem: (key: string) => {
          storage.delete(key)
        }
      }
    }
  })

  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: globalThis.window.localStorage
  })

  try {
    const { api } = require('../lib/api')

    const [first, second] = await Promise.all([
      api.get('/protected'),
      api.get('/protected')
    ])

    expect(first.status).toBe(200)
    expect(second.status).toBe(200)
    expect(refreshCallCount).toBe(1)
    expect(storage.get('servio_access_token')).toBe('new-access-token')
  } finally {
    process.env.NEXT_PUBLIC_API_URL = previousApiUrl
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error)
          return
        }
        resolve()
      })
    })
  }
})
