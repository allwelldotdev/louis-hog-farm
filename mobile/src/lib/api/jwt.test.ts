import { describe, expect, it } from 'vitest'

import { REFRESH_SKEW_SECONDS, expiresWithin, tokenExpiry } from './jwt'

/** A JWT whose payload carries the given `exp`. The signature is never read. */
function tokenWithExp(exp: number | string | null): string {
  const payload = exp === null ? {} : { sub: '1', typ: 'access', exp }
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url')
  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode(payload)}.signature`
}

const NOW = Date.UTC(2026, 7, 1, 12, 0, 0)
const nowSeconds = NOW / 1000

describe('tokenExpiry', () => {
  it('reads the exp claim', () => {
    expect(tokenExpiry(tokenWithExp(nowSeconds + 600))).toBe(nowSeconds + 600)
  })

  it('returns null for anything it cannot read', () => {
    expect(tokenExpiry(null)).toBeNull()
    expect(tokenExpiry(undefined)).toBeNull()
    expect(tokenExpiry('')).toBeNull()
    expect(tokenExpiry('not.a.jwt')).toBeNull()
    expect(tokenExpiry('only-one-part')).toBeNull()
    expect(tokenExpiry(tokenWithExp(null))).toBeNull()
    expect(tokenExpiry(tokenWithExp('soon'))).toBeNull()
  })
})

describe('expiresWithin', () => {
  it('is false for a token with plenty of life left', () => {
    // Access tokens live 30 minutes; 20 remaining is comfortably fresh.
    expect(expiresWithin(tokenWithExp(nowSeconds + 20 * 60), REFRESH_SKEW_SECONDS, NOW)).toBe(false)
  })

  it('is true inside the skew window', () => {
    expect(expiresWithin(tokenWithExp(nowSeconds + 60), REFRESH_SKEW_SECONDS, NOW)).toBe(true)
  })

  it('is true for an already-expired token', () => {
    // The phone-slept-45-minutes case this whole module exists for.
    expect(expiresWithin(tokenWithExp(nowSeconds - 45 * 60), REFRESH_SKEW_SECONDS, NOW)).toBe(true)
  })

  it('treats an unreadable token as expiring', () => {
    // A needless refresh is cheaper than a failed write in a barn.
    expect(expiresWithin('garbage', REFRESH_SKEW_SECONDS, NOW)).toBe(true)
    expect(expiresWithin(null, REFRESH_SKEW_SECONDS, NOW)).toBe(true)
  })

  it('refreshes five minutes ahead by default', () => {
    expect(REFRESH_SKEW_SECONDS).toBe(300)
  })
})
