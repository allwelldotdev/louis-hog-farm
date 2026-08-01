import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ACCESS_KEY, REFRESH_KEY, createApiClient, type TokenStorage } from './client'
import { ApiError, AuthExpiredError } from './errors'

const BASE = 'http://10.0.0.4:8000'

function memoryStorage(initial: Record<string, string> = {}): TokenStorage {
  const map = new Map(Object.entries(initial))
  return {
    get: async (key) => map.get(key) ?? null,
    set: async (key, value) => void map.set(key, value),
    remove: async (key) => void map.delete(key),
  }
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

/** Records every call so the tests can assert on ordering and counts. */
function recordingFetch(handler: (url: string, init?: RequestInit) => Response) {
  const calls: { url: string; init?: RequestInit }[] = []
  const impl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    calls.push({ url, init })
    return handler(url, init)
  })
  return { impl: impl as unknown as typeof fetch, calls }
}

describe('auth header', () => {
  it('attaches the stored access token as a bearer', async () => {
    const { impl, calls } = recordingFetch(() => json(200, { id: 1 }))
    const client = createApiClient({
      storage: memoryStorage({ [ACCESS_KEY]: 'token-a' }),
      getBase: () => BASE,
      fetchImpl: impl,
    })

    await client.get('/users/me')

    expect(calls[0].url).toBe(`${BASE}/api/v1/users/me`)
    expect((calls[0].init?.headers as Record<string, string>).authorization).toBe('Bearer token-a')
  })

  it('refuses to build a request with no server configured', async () => {
    const client = createApiClient({
      storage: memoryStorage(),
      getBase: () => null,
      fetchImpl: recordingFetch(() => json(200, {})).impl,
    })
    await expect(client.get('/users/me')).rejects.toThrow(/server address/i)
  })
})

describe('single-flight refresh', () => {
  let storage: TokenStorage

  beforeEach(() => {
    storage = memoryStorage({ [ACCESS_KEY]: 'stale', [REFRESH_KEY]: 'refresh-1' })
  })

  it('fires exactly one refresh for concurrent 401s and replays them all', async () => {
    // The Today screen issues four reads at once. Without single-flighting
    // each 401 starts its own refresh: four round trips where one will do, and
    // four SecureStore writes racing each other.
    const { impl, calls } = recordingFetch((url, init) => {
      if (url.endsWith('/auth/refresh')) {
        return json(200, { access_token: 'fresh', refresh_token: 'refresh-2' })
      }
      const auth = (init?.headers as Record<string, string> | undefined)?.authorization
      return auth === 'Bearer fresh' ? json(200, { ok: true }) : json(401, { detail: 'expired' })
    })

    const client = createApiClient({ storage, getBase: () => BASE, fetchImpl: impl })

    const results = await Promise.all([
      client.get('/dashboard/kpis'),
      client.get('/hogs'),
      client.get('/alerts'),
      client.get('/meta/data-version'),
    ])

    expect(results).toEqual([{ ok: true }, { ok: true }, { ok: true }, { ok: true }])

    const refreshCalls = calls.filter((call) => call.url.endsWith('/auth/refresh'))
    expect(refreshCalls).toHaveLength(1)

    // 4 initial 401s + 1 refresh + 4 replays
    expect(calls).toHaveLength(9)
  })

  it('writes back the rotated refresh token, not just the access token', async () => {
    const { impl } = recordingFetch((url, init) => {
      if (url.endsWith('/auth/refresh')) {
        return json(200, { access_token: 'fresh', refresh_token: 'refresh-2' })
      }
      const auth = (init?.headers as Record<string, string> | undefined)?.authorization
      return auth === 'Bearer fresh' ? json(200, { ok: true }) : json(401, { detail: 'expired' })
    })

    const client = createApiClient({ storage, getBase: () => BASE, fetchImpl: impl })
    await client.get('/hogs')

    expect(await storage.get(ACCESS_KEY)).toBe('fresh')
    // Against the real backend the two strings are usually identical (the
    // refresh payload has no jti and a second-resolution exp), so this is the
    // only place the write-back can actually be observed.
    expect(await storage.get(REFRESH_KEY)).toBe('refresh-2')
  })

  it('replays only once — a second 401 is terminal', async () => {
    const { impl, calls } = recordingFetch((url) =>
      url.endsWith('/auth/refresh')
        ? json(200, { access_token: 'fresh', refresh_token: 'refresh-2' })
        : json(401, { detail: 'still expired' }),
    )

    const client = createApiClient({ storage, getBase: () => BASE, fetchImpl: impl })

    await expect(client.get('/hogs')).rejects.toBeInstanceOf(ApiError)
    // original + refresh + one replay, then it stops rather than looping
    expect(calls).toHaveLength(3)
  })

  it('signs out when the refresh token is rejected', async () => {
    const onAuthExpired = vi.fn()
    const { impl } = recordingFetch((url) =>
      url.endsWith('/auth/refresh')
        ? json(401, { detail: 'bad token' })
        : json(401, { detail: 'x' }),
    )

    const client = createApiClient({ storage, getBase: () => BASE, onAuthExpired, fetchImpl: impl })

    await expect(client.get('/hogs')).rejects.toBeInstanceOf(AuthExpiredError)
    expect(onAuthExpired).toHaveBeenCalledTimes(1)
    expect(await storage.get(ACCESS_KEY)).toBeNull()
    expect(await storage.get(REFRESH_KEY)).toBeNull()
  })

  it('keeps the tokens when the refresh fails on the network', async () => {
    // Offline is not an invalid session. Clearing here would sign a worker out
    // for walking into a shed.
    const onAuthExpired = vi.fn()
    const impl = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).endsWith('/auth/refresh')) throw new TypeError('Network request failed')
      return json(401, { detail: 'expired' })
    }) as unknown as typeof fetch

    const client = createApiClient({ storage, getBase: () => BASE, onAuthExpired, fetchImpl: impl })

    await expect(client.get('/hogs')).rejects.toBeInstanceOf(AuthExpiredError)
    expect(await storage.get(REFRESH_KEY)).toBe('refresh-1')
  })

  it('does not try to refresh a failed login', async () => {
    // Otherwise a wrong password turns into a refresh attempt and the error
    // the user sees is about the session rather than the password.
    const { impl, calls } = recordingFetch(() =>
      json(401, { detail: 'Incorrect email or password' }),
    )
    const client = createApiClient({ storage, getBase: () => BASE, fetchImpl: impl })

    await expect(client.login('a@b.com', 'wrong')).rejects.toThrow('Incorrect email or password')
    expect(calls.filter((call) => call.url.endsWith('/auth/refresh'))).toHaveLength(0)
  })
})

describe('login', () => {
  it('posts form-encoded credentials with the email as username', async () => {
    // The one non-JSON call in the app: /auth/login takes an
    // OAuth2PasswordRequestForm.
    const storage = memoryStorage()
    const { impl, calls } = recordingFetch(() =>
      json(200, { access_token: 'a', refresh_token: 'r', token_type: 'bearer' }),
    )
    const client = createApiClient({ storage, getBase: () => BASE, fetchImpl: impl })

    await client.login('manager@brightacres.com', 'Bright123!')

    const headers = calls[0].init?.headers as Record<string, string>
    expect(headers['content-type']).toBe('application/x-www-form-urlencoded')
    expect(calls[0].init?.body).toBe('username=manager%40brightacres.com&password=Bright123%21')
    expect(await storage.get(ACCESS_KEY)).toBe('a')
    expect(await storage.get(REFRESH_KEY)).toBe('r')
  })
})

describe('query strings', () => {
  it('drops empty params so a cleared filter is not sent as blank', async () => {
    const { impl, calls } = recordingFetch(() => json(200, { items: [] }))
    const client = createApiClient({
      storage: memoryStorage(),
      getBase: () => BASE,
      fetchImpl: impl,
    })

    await client.get('/hogs', { limit: 200, breed: '', status: undefined, offset: 0 })

    expect(calls[0].url).toBe(`${BASE}/api/v1/hogs?limit=200&offset=0`)
  })
})
