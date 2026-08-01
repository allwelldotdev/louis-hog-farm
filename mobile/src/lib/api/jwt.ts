/**
 * Just enough JWT to know when a token is about to expire.
 *
 * No signature check and no library. The server remains the authority on
 * validity — this only decides whether to refresh *before* making a request
 * rather than after being refused, so being wrong costs one extra round trip,
 * not a security hole.
 *
 * The problem it solves: the access token lives 30 minutes. A worker locks the
 * phone at 09:00 and pulls it out at 10:15. Reactive 401-then-refresh works,
 * but it spends a visible failed round trip on the first action after wake —
 * and if that action is a form submit, the user watches a spinner stall for no
 * reason they can see.
 */

/** Refresh if the token dies within this many seconds of now. */
export const REFRESH_SKEW_SECONDS = 5 * 60

function decodeSegment(segment: string): unknown {
  // JWT uses base64url; atob wants standard base64 with padding.
  const base64 = segment.replace(/-/g, '+').replace(/_/g, '/')
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=')
  return JSON.parse(globalThis.atob(padded))
}

/** The `exp` claim in seconds since the epoch, or `null` if unreadable. */
export function tokenExpiry(token: string | null | undefined): number | null {
  if (!token) return null
  const parts = token.split('.')
  if (parts.length !== 3) return null
  try {
    const payload = decodeSegment(parts[1])
    if (payload && typeof payload === 'object' && 'exp' in payload) {
      const exp = (payload as { exp: unknown }).exp
      return typeof exp === 'number' && Number.isFinite(exp) ? exp : null
    }
    return null
  } catch {
    return null
  }
}

/**
 * Is this token expired, or close enough that it will be mid-request?
 *
 * An unreadable token counts as expiring: if it cannot be parsed it cannot be
 * trusted to still work, and a needless refresh is cheaper than a failed write
 * in a barn.
 */
export function expiresWithin(
  token: string | null | undefined,
  seconds: number = REFRESH_SKEW_SECONDS,
  nowMs: number = Date.now(),
): boolean {
  const exp = tokenExpiry(token)
  if (exp === null) return true
  return exp * 1000 - nowMs <= seconds * 1000
}
