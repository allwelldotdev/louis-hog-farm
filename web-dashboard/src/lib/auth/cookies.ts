/**
 * Session cookie names and options.
 *
 * Tokens live in httpOnly cookies, never in localStorage. The old dashboard
 * kept its access token in localStorage behind a `getToken()` helper, which
 * meant any script on the page could read it and that logging out was a
 * best-effort client-side erase. Nothing in the browser can read these.
 *
 * Kept free of `next/headers` so the route gate in `proxy.ts` can import the
 * names without pulling in server-only APIs.
 */
export const ACCESS_COOKIE = 'hogfarm_access'
export const REFRESH_COOKIE = 'hogfarm_refresh'

// Mirrors the backend's JWT_ACCESS_EXPIRE_MINUTES / JWT_REFRESH_EXPIRE_DAYS.
// The cookie outliving its token would only mean a wasted request; the cookie
// dying first would log the user out early, so both are set to match.
export const ACCESS_MAX_AGE = 60 * 30
export const REFRESH_MAX_AGE = 60 * 60 * 24 * 7

export function sessionCookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge,
  }
}

export type TokenPair = {
  access_token: string
  refresh_token: string
}
