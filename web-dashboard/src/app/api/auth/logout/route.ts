import { NextResponse } from 'next/server'

import { clearTokens } from '@/lib/auth/session'

/**
 * End the session.
 *
 * Deleting the cookies is the whole of it — there is no client-side token to
 * forget. The caller is responsible for clearing the TanStack Query cache
 * before navigating away, or the next person to sign in on this browser sees
 * the previous farm's numbers painted from cache.
 */
export async function POST() {
  await clearTokens()
  return NextResponse.json({ ok: true })
}
