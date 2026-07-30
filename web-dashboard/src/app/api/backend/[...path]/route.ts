import { NextResponse, type NextRequest } from 'next/server'

import { v1 } from '@/lib/api/backend'
import type { TokenPair } from '@/lib/auth/cookies'
import { clearTokens, readTokens, writeTokens } from '@/lib/auth/session'

/**
 * The single door between the browser and FastAPI.
 *
 * Everything the dashboard reads or writes goes through here. The route reads
 * the access token from an httpOnly cookie and attaches it server-side, so the
 * browser holds no credential and never sees the API's address.
 *
 * Three things it must get right:
 *
 * 1. **`If-None-Match` in, `ETag` out.** The backend answers dashboard reads
 *    with a 304 when the farm's data version has not moved. Dropping either
 *    header here would not break anything visibly — it would just silently turn
 *    every poll back into a full recompute, which is the failure mode worth
 *    guarding against because nothing about it looks wrong.
 * 2. **One refresh, then give up.** A 401 gets one attempt at a new token pair
 *    and one replay. Retrying further would loop against a dead session.
 * 3. **Stream the response through.** CSV exports are `StreamingResponse` on
 *    the backend; buffering them here would undo that.
 */

const FORWARDED_REQUEST_HEADERS = ['content-type', 'accept', 'if-none-match']
const FORWARDED_RESPONSE_HEADERS = ['content-type', 'etag', 'cache-control', 'content-disposition']

type RouteContext = { params: Promise<{ path: string[] }> }

function upstreamHeaders(request: NextRequest, accessToken: string | undefined): Headers {
  const headers = new Headers()
  for (const name of FORWARDED_REQUEST_HEADERS) {
    const value = request.headers.get(name)
    if (value) headers.set(name, value)
  }
  if (accessToken) headers.set('authorization', `Bearer ${accessToken}`)
  return headers
}

function passThrough(upstream: Response): NextResponse {
  const headers = new Headers()
  for (const name of FORWARDED_RESPONSE_HEADERS) {
    const value = upstream.headers.get(name)
    if (value) headers.set(name, value)
  }
  // A 304 carries no body by definition; handing Next a stream for one throws.
  const body = upstream.status === 304 ? null : upstream.body
  return new NextResponse(body, { status: upstream.status, headers })
}

/** Swap the refresh cookie for a new pair. Returns the new access token, or
 *  null when the session is genuinely over. */
async function refreshAccessToken(): Promise<string | null> {
  const { refresh } = await readTokens()
  if (!refresh) return null

  const upstream = await fetch(v1('/auth/refresh'), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ refresh_token: refresh }),
    cache: 'no-store',
  })

  if (!upstream.ok) {
    upstream.body?.cancel()
    await clearTokens()
    return null
  }

  const tokens = (await upstream.json()) as TokenPair
  await writeTokens(tokens)
  return tokens.access_token
}

async function handle(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  const { path } = await context.params
  const target = v1(`/${path.join('/')}${request.nextUrl.search}`)

  // Read once: the body has to survive a replay after a token refresh.
  const hasBody = request.method !== 'GET' && request.method !== 'HEAD'
  const body = hasBody ? await request.text() : undefined

  const { access } = await readTokens()
  let upstream = await fetch(target, {
    method: request.method,
    headers: upstreamHeaders(request, access),
    body,
    cache: 'no-store',
    redirect: 'manual',
  })

  if (upstream.status === 401) {
    upstream.body?.cancel()
    const renewed = await refreshAccessToken()
    if (!renewed) {
      return NextResponse.json(
        { error: 'Your session has expired. Sign in again.' },
        { status: 401 },
      )
    }
    upstream = await fetch(target, {
      method: request.method,
      headers: upstreamHeaders(request, renewed),
      body,
      cache: 'no-store',
      redirect: 'manual',
    })
  }

  return passThrough(upstream)
}

export const GET = handle
export const POST = handle
export const PATCH = handle
export const PUT = handle
export const DELETE = handle
