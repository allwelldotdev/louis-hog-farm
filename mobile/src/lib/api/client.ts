import { ApiError, AuthExpiredError, extractError } from './errors'
import { expiresWithin } from './jwt'

/**
 * The API client — everything the dashboard's BFF does, minus the BFF.
 *
 * On the web, `web-dashboard/src/app/api/backend/[...path]/route.ts` runs on
 * the Next server: it attaches the bearer token from an httpOnly cookie,
 * retries once on 401 via `/auth/refresh`, and forwards ETag headers. None of
 * that ports — there is no server here — so it all lives in this file, with
 * tokens in SecureStore instead of cookies.
 *
 * Storage and platform access are injected rather than imported, which is what
 * lets this module be tested in plain node (see `vitest.config.mts`).
 */

export const ACCESS_KEY = 'hogfarm.access'
export const REFRESH_KEY = 'hogfarm.refresh'

export type TokenStorage = {
  get(key: string): Promise<string | null>
  set(key: string, value: string): Promise<void>
  remove(key: string): Promise<void>
}

export type ApiClient = ReturnType<typeof createApiClient>

type Query = Record<string, string | number | boolean | undefined | null>

function withQuery(path: string, params?: Query): string {
  if (!params) return path
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') search.set(key, String(value))
  }
  const query = search.toString()
  return query ? `${path}?${query}` : path
}

export function createApiClient(options: {
  storage: TokenStorage
  /** Re-read per request: Settings can change the server without a restart. */
  getBase: () => string | null
  /** Called once when the refresh token is gone or rejected. */
  onAuthExpired?: () => void
  fetchImpl?: typeof fetch
}) {
  const { storage, getBase, onAuthExpired } = options
  const doFetch = options.fetchImpl ?? fetch

  /**
   * Single-flight refresh.
   *
   * The Today screen fires four queries at once, so a wake-up with an expired
   * token would otherwise send four refreshes: four round trips where one will
   * do, four writes to SecureStore racing each other, and a dependency on the
   * server happening to mint interchangeable tokens. Collapsing them to one
   * removes all three.
   */
  let inFlight: Promise<string | null> | null = null

  function root(): string {
    const base = getBase()
    if (!base)
      throw new ApiError(0, 'No server address is configured. Set one on the sign-in screen.')
    return `${base}/api/v1`
  }

  async function doRefresh(): Promise<string | null> {
    const refreshToken = await storage.get(REFRESH_KEY)
    if (!refreshToken) return null

    let response: Response
    try {
      response = await doFetch(`${root()}/auth/refresh`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken }),
      })
    } catch {
      // A network failure is not an invalid session — leave the tokens alone
      // so the next attempt on a working connection can still succeed.
      return null
    }

    if (!response.ok) {
      await clearTokens()
      return null
    }

    const tokens = (await response.json()) as { access_token: string; refresh_token: string }
    // Store both, not just the access token. `/auth/refresh` mints a fresh
    // refresh token as well, and dropping it would leave the app holding one
    // with an older expiry than the server just issued.
    //
    // Worth knowing, because it makes the concurrency here look harmless than
    // it is: the refresh payload is `{sub, exp, typ}` with no jti and a
    // second-resolution `exp` (backend/app/core/security.py), so two refreshes
    // in the same second return byte-identical strings. The rotation is
    // nominal today. The single-flight below is still the right shape — it is
    // one round trip instead of four, and it does not depend on that
    // implementation detail staying true.
    await storage.set(ACCESS_KEY, tokens.access_token)
    await storage.set(REFRESH_KEY, tokens.refresh_token)
    return tokens.access_token
  }

  function refresh(): Promise<string | null> {
    inFlight ??= doRefresh().finally(() => {
      inFlight = null
    })
    return inFlight
  }

  async function clearTokens(): Promise<void> {
    await storage.remove(ACCESS_KEY)
    await storage.remove(REFRESH_KEY)
  }

  async function parse<T>(response: Response): Promise<T> {
    if (!response.ok) {
      const body = await response.json().catch(() => null)
      throw extractError(response.status, body)
    }
    if (response.status === 204) return undefined as T
    return (await response.json()) as T
  }

  async function send(
    path: string,
    init: RequestInit & { body?: string },
    { retry = true }: { retry?: boolean } = {},
  ): Promise<Response> {
    const token = await storage.get(ACCESS_KEY)

    const response = await doFetch(`${root()}${path}`, {
      ...init,
      headers: {
        accept: 'application/json',
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...init.headers,
      },
    })

    // `/auth/*` refuses on its own terms; refreshing in response to a bad
    // password would be a loop.
    if (response.status !== 401 || !retry || path.startsWith('/auth/')) return response

    const renewed = await refresh()
    if (!renewed) {
      onAuthExpired?.()
      throw new AuthExpiredError()
    }

    // The body was already serialised to a string by the callers below, so it
    // survives being sent a second time — a stream would not have.
    return send(path, init, { retry: false })
  }

  /** Refresh ahead of time if the stored token is about to expire. */
  async function ensureFreshToken(): Promise<void> {
    const token = await storage.get(ACCESS_KEY)
    if (!token) return
    if (expiresWithin(token)) await refresh()
  }

  return {
    async get<T>(path: string, params?: Query): Promise<T> {
      return parse<T>(await send(withQuery(path, params), { method: 'GET' }))
    },

    async mutate<T>(
      method: 'POST' | 'PATCH' | 'PUT' | 'DELETE',
      path: string,
      body?: unknown,
    ): Promise<T> {
      return parse<T>(
        await send(path, {
          method,
          headers: { 'content-type': 'application/json' },
          body: body === undefined ? undefined : JSON.stringify(body),
        }),
      )
    },

    /**
     * The only form-encoded call in the app.
     *
     * `/auth/login` takes an OAuth2PasswordRequestForm, so the email goes in a
     * field called `username` and the body is urlencoded — everything else the
     * app sends is JSON, which makes this very easy to get wrong.
     */
    async login(email: string, password: string): Promise<void> {
      const body = new URLSearchParams({ username: email, password }).toString()
      const response = await doFetch(`${root()}/auth/login`, {
        method: 'POST',
        headers: {
          'content-type': 'application/x-www-form-urlencoded',
          accept: 'application/json',
        },
        body,
      })
      const tokens = await parse<{ access_token: string; refresh_token: string }>(response)
      await storage.set(ACCESS_KEY, tokens.access_token)
      await storage.set(REFRESH_KEY, tokens.refresh_token)
    },

    async register(input: {
      email: string
      password: string
      full_name: string
      farm_name: string
    }): Promise<void> {
      const response = await doFetch(`${root()}/auth/register`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify(input),
      })
      await parse(response)
    },

    /** Is there a session to restore at boot? */
    async hasSession(): Promise<boolean> {
      return (await storage.get(REFRESH_KEY)) !== null
    },

    ensureFreshToken,
    signOut: clearTokens,
  }
}
