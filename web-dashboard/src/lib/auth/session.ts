import { cookies } from 'next/headers'

import {
  ACCESS_COOKIE,
  ACCESS_MAX_AGE,
  REFRESH_COOKIE,
  REFRESH_MAX_AGE,
  sessionCookieOptions,
  type TokenPair,
} from './cookies'

/** Server-side session access. Importing this from a client component fails at
 *  build time, because `next/headers` is server-only. */

export async function readTokens(): Promise<{
  access: string | undefined
  refresh: string | undefined
}> {
  const store = await cookies()
  return {
    access: store.get(ACCESS_COOKIE)?.value,
    refresh: store.get(REFRESH_COOKIE)?.value,
  }
}

export async function writeTokens(tokens: TokenPair): Promise<void> {
  const store = await cookies()
  store.set(ACCESS_COOKIE, tokens.access_token, sessionCookieOptions(ACCESS_MAX_AGE))
  store.set(REFRESH_COOKIE, tokens.refresh_token, sessionCookieOptions(REFRESH_MAX_AGE))
}

export async function clearTokens(): Promise<void> {
  const store = await cookies()
  store.delete(ACCESS_COOKIE)
  store.delete(REFRESH_COOKIE)
}

export async function isSignedIn(): Promise<boolean> {
  const { refresh } = await readTokens()
  return Boolean(refresh)
}
