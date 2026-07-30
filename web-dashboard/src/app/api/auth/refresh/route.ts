import { NextResponse } from 'next/server'

import { v1 } from '@/lib/api/backend'
import { clearTokens, readTokens, writeTokens } from '@/lib/auth/session'
import type { TokenPair } from '@/lib/auth/cookies'

/**
 * Mint a fresh token pair from the refresh cookie.
 *
 * The access token expires after 30 minutes and a screenshot session runs
 * longer than that. Until now `refresh_token` was returned by the API and
 * thrown away, so the dashboard simply stopped working mid-session.
 *
 * Documented limitation rather than a fix: the backend's refresh has no
 * rotation detection and no revocation list, so a stolen refresh token stays
 * valid for its full seven days. Acceptable for a local-first system, and
 * stated plainly in SPEC rather than left for someone to discover.
 */
export async function POST() {
  const { refresh } = await readTokens()
  if (!refresh) {
    return NextResponse.json({ error: 'No session to refresh' }, { status: 401 })
  }

  const upstream = await fetch(v1('/auth/refresh'), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ refresh_token: refresh }),
    cache: 'no-store',
  })

  if (!upstream.ok) {
    // A refresh token the backend rejects is a dead session, not a retryable
    // error. Clearing here stops the browser looping on a token that can never
    // work again.
    await clearTokens()
    return NextResponse.json({ error: 'Session expired' }, { status: 401 })
  }

  const tokens = (await upstream.json()) as TokenPair
  await writeTokens(tokens)
  return NextResponse.json({ ok: true })
}
