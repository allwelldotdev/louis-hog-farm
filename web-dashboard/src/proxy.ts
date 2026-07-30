import { NextResponse, type NextRequest } from 'next/server'

import { REFRESH_COOKIE } from '@/lib/auth/cookies'

/**
 * Route gate. Signed-out visitors get the sign-in page; signed-in visitors
 * never see it.
 *
 * Next 16 renamed `middleware.ts` to `proxy.ts` and moved it onto the Node
 * runtime. The accompanying guidance is to keep it thin — presence checks and
 * redirects, no signature verification and no database work — so this only
 * looks at whether a session cookie exists. The tokens are still validated
 * where it counts: by FastAPI, on every request the passthrough route makes.
 *
 * It gates on the **refresh** cookie, not the access cookie. The access token
 * lives 30 minutes and the refresh token a week; gating on the short one would
 * bounce a user to the sign-in page every half hour while their session was
 * still perfectly alive and the passthrough route was ready to renew it.
 *
 * This is also what closes audit k: an unauthenticated visitor is redirected
 * before any protected page renders, so there is no flash of content they
 * should not have seen.
 */

const PUBLIC_ROUTES = new Set(['/', '/register'])

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const signedIn = Boolean(request.cookies.get(REFRESH_COOKIE)?.value)
  const isPublic = PUBLIC_ROUTES.has(pathname)

  if (!signedIn && !isPublic) {
    const target = new URL('/', request.url)
    // Come back to where they were headed once they have signed in.
    target.searchParams.set('next', pathname)
    return NextResponse.redirect(target)
  }

  if (signedIn && isPublic) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return NextResponse.next()
}

export const config = {
  // `/api` is excluded: the auth handlers must stay reachable while signed out,
  // and the passthrough route does its own token handling.
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}
