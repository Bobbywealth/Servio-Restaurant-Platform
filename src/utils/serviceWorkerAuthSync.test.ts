import {
  registerTokenStorageSync,
  resetServiceWorkerTokenSyncState,
  syncTokenToServiceWorker,
} from '../../frontend/lib/serviceWorkerAuth'

describe('service worker auth sync helpers', () => {
  afterEach(() => {
    resetServiceWorkerTokenSyncState()
    // @ts-expect-error test cleanup
    delete global.window
    // @ts-expect-error test cleanup
    delete global.navigator
  })

  it('registers storage listener once and removes it on cleanup', () => {
    const addEventListener = jest.fn()
    const removeEventListener = jest.fn()

    // @ts-expect-error test mock
    global.window = { addEventListener, removeEventListener }

    const onTokenChange = jest.fn()
    const cleanup = registerTokenStorageSync(onTokenChange)

    expect(addEventListener).toHaveBeenCalledTimes(1)
    expect(addEventListener).toHaveBeenCalledWith('storage', expect.any(Function))

    const handler = addEventListener.mock.calls[0][1]
    handler({ key: 'servio_access_token', newValue: 'token-1' })
    handler({ key: 'other_key', newValue: 'ignored' })

    expect(onTokenChange).toHaveBeenCalledTimes(1)
    expect(onTokenChange).toHaveBeenCalledWith('token-1')

    cleanup()

    expect(removeEventListener).toHaveBeenCalledTimes(1)
    expect(removeEventListener).toHaveBeenCalledWith('storage', handler)
  })

  it('syncs token updates immediately in same tab via explicit calls', async () => {
    const postMessage = jest.fn()
    const ready = Promise.resolve({
      active: { postMessage }
    })

    // @ts-expect-error test mock
    global.navigator = { serviceWorker: { ready } }

    syncTokenToServiceWorker('new-token')
    await Promise.resolve()

    expect(postMessage).toHaveBeenCalledWith({
      type: 'SET_AUTH_TOKEN',
      payload: { token: 'new-token' }
    })

    syncTokenToServiceWorker(null)
    await Promise.resolve()

    expect(postMessage).toHaveBeenCalledWith({
      type: 'CLEAR_AUTH_TOKEN'
    })
  })
})
