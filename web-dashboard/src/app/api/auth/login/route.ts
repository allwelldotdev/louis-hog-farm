import { NextResponse } from 'next/server'

import { readDetail, v1 } from '@/lib/api/backend'
import { writeTokens } from '@/lib/auth/session'
import type { TokenPair } from '@/lib/auth/cookies'

/**
 * Exchange credentials for a session.
 *
 * The tokens are written to httpOnly cookies and never reach the browser's
 * JavaScript. The response body carries nothing but a status, so there is no
 * client-side auth state that can go stale — which is what made the old
 * dashboard's logout fail to re-render (audit j).
 */
export async function POST(request: Request) {
  let body: { email?: string; password?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Expected a JSON body' }, { status: 400 })
  }

  if (!body.email || !body.password) {
    return NextResponse.json({ error: 'Enter your email and password' }, { status: 400 })
  }

  // The backend's login is an OAuth2 password form, not JSON.
  const form = new URLSearchParams({ username: body.email, password: body.password })

  const upstream = await fetch(v1('/auth/login'), {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: form,
    cache: 'no-store',
  })

  const payload = await upstream.json().catch(() => null)

  if (!upstream.ok) {
    return NextResponse.json(
      { error: readDetail(payload, 'Could not sign in') },
      { status: upstream.status },
    )
  }

  await writeTokens(payload as TokenPair)
  return NextResponse.json({ ok: true })
}
