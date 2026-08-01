import { describe, expect, it } from 'vitest'

import { apiRoot, baseFromMetroHost, normaliseBase, resolveBaseUrl } from './base-url'

describe('normaliseBase', () => {
  it('strips trailing slashes and whitespace', () => {
    expect(normaliseBase('  http://10.0.0.4:8000/  ')).toBe('http://10.0.0.4:8000')
    expect(normaliseBase('http://10.0.0.4:8000///')).toBe('http://10.0.0.4:8000')
  })

  it('accepts both schemes and a bare hostname', () => {
    expect(normaliseBase('https://farm.example.com')).toBe('https://farm.example.com')
    expect(normaliseBase('http://localhost:8000')).toBe('http://localhost:8000')
  })

  it('rejects anything unusable rather than throwing', () => {
    // A bad value stored on the device must fall through to the next source,
    // not crash the app at boot.
    for (const value of ['', '   ', null, undefined, '10.0.0.4:8000', 'ftp://x', 'not a url']) {
      expect(normaliseBase(value)).toBeNull()
    }
  })
})

describe('apiRoot', () => {
  it('appends the prefix every router is mounted under', () => {
    expect(apiRoot('http://10.0.0.4:8000')).toBe('http://10.0.0.4:8000/api/v1')
  })
})

describe('baseFromMetroHost', () => {
  it('reuses the Metro host on the API port', () => {
    // Metro is on 8081, the API on 8000 — same machine, different servers.
    expect(baseFromMetroHost('10.185.45.98:8081')).toBe('http://10.185.45.98:8000')
  })

  it('copes with a scheme or a path being present', () => {
    expect(baseFromMetroHost('http://10.185.45.98:8081')).toBe('http://10.185.45.98:8000')
    expect(baseFromMetroHost('10.185.45.98:8081/_expo')).toBe('http://10.185.45.98:8000')
  })

  it('handles a hostUri with no port', () => {
    expect(baseFromMetroHost('10.185.45.98')).toBe('http://10.185.45.98:8000')
  })

  it('returns null when there is no Metro host, as in a standalone build', () => {
    expect(baseFromMetroHost(null)).toBeNull()
    expect(baseFromMetroHost(undefined)).toBeNull()
    expect(baseFromMetroHost('')).toBeNull()
  })
})

describe('resolveBaseUrl', () => {
  const hostUri = '10.185.45.98:8081'

  it('prefers the on-device override above everything', () => {
    expect(
      resolveBaseUrl({ override: 'http://192.168.1.7:8000', env: 'http://10.0.0.4:8000', hostUri }),
    ).toBe('http://192.168.1.7:8000')
  })

  it('falls back to the environment variable', () => {
    expect(resolveBaseUrl({ override: null, env: 'http://10.0.0.4:8000', hostUri })).toBe(
      'http://10.0.0.4:8000',
    )
  })

  it('falls back to the Metro host so a blank .env still works', () => {
    expect(resolveBaseUrl({ override: null, env: '', hostUri })).toBe('http://10.185.45.98:8000')
  })

  it('skips an unusable override instead of being blocked by it', () => {
    expect(resolveBaseUrl({ override: 'garbage', env: 'http://10.0.0.4:8000', hostUri })).toBe(
      'http://10.0.0.4:8000',
    )
  })

  it('returns null when nothing at all is configured', () => {
    expect(resolveBaseUrl({})).toBeNull()
  })
})
