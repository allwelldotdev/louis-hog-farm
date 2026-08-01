/**
 * Where the API lives.
 *
 * The dashboard has no equivalent of this file: the browser only ever talks to
 * Next, which proxies server-side, so there is no address to configure and
 * CORS is a non-issue. The phone talks to FastAPI directly, so the address
 * becomes a real piece of configuration — and the single most common reason a
 * fresh setup does not work.
 *
 * Pure functions only; `src/api-runtime.ts` does the storage and Constants
 * reads and calls into these.
 */

export const API_URL_STORAGE_KEY = 'hogfarm:api-url'

/** The API's own default port. Metro's is 8081; these are different servers. */
export const DEFAULT_API_PORT = 8000

/**
 * Trim, drop a trailing slash, and reject anything that is not http(s).
 *
 * Returns `null` rather than throwing so a bad value stored on the device
 * falls through to the next source instead of crashing the app at boot.
 */
export function normaliseBase(raw: string | null | undefined): string | null {
  if (!raw) return null
  const trimmed = raw.trim().replace(/\/+$/, '')
  if (!/^https?:\/\/[^/\s]+/i.test(trimmed)) return null
  return trimmed
}

/** All routers are mounted under this prefix (`backend/app/main.py`). */
export function apiRoot(base: string): string {
  return `${base}/api/v1`
}

/**
 * Derive the API address from the host Metro served the bundle from.
 *
 * `Constants.expoConfig.hostUri` is something like `"10.185.45.98:8081"` — the
 * machine the phone just downloaded the app from, which in a `make mobile` +
 * Expo Go session is also the machine running `make api`. Reusing that host on
 * port 8000 makes the default configuration correct with no setup at all.
 *
 * This is the *last* fallback, below the stored override and the environment
 * variable, and it is a development convenience: a standalone build has no
 * `hostUri` and must be configured explicitly.
 */
export function baseFromMetroHost(hostUri: string | null | undefined): string | null {
  if (!hostUri) return null
  // Strip any scheme, then any path, then the port. IPv6 in a hostUri is not a
  // case Expo Go produces on a LAN, so a plain rsplit on ':' is enough.
  const withoutScheme = hostUri.replace(/^[a-z]+:\/\//i, '')
  const hostAndPort = withoutScheme.split('/')[0]
  const host = hostAndPort.includes(':')
    ? hostAndPort.slice(0, hostAndPort.lastIndexOf(':'))
    : hostAndPort
  if (!host) return null
  return `http://${host}:${DEFAULT_API_PORT}`
}

/**
 * The resolution order, as one pure function so it can be tested whole.
 *
 * 1. the on-device override, set from sign-in or Settings
 * 2. `EXPO_PUBLIC_API_URL` from `mobile/.env`
 * 3. the Metro host, so a fresh clone is not dead on arrival
 */
export function resolveBaseUrl(sources: {
  override?: string | null
  env?: string | null
  hostUri?: string | null
}): string | null {
  return (
    normaliseBase(sources.override) ??
    normaliseBase(sources.env) ??
    normaliseBase(baseFromMetroHost(sources.hostUri))
  )
}
