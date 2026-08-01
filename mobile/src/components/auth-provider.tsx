import { useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'expo-router'
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'

import { api, onAuthExpired } from '@/api-runtime'
import { clearPersistedCache } from '@/lib/query/client'

/**
 * Session state, and the one place sign-out is defined.
 *
 * "Signed in" means a refresh token exists on the device — not that a request
 * has succeeded. The access token may well be expired after a night on a
 * charger; that is the client's problem to solve on the next call, not a
 * reason to show the sign-in screen.
 */

type AuthStatus = 'loading' | 'signed-in' | 'signed-out'

type AuthContextValue = {
  status: AuthStatus
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading')
  const queryClient = useQueryClient()
  const router = useRouter()

  useEffect(() => {
    api
      .hasSession()
      .then((hasSession) => setStatus(hasSession ? 'signed-in' : 'signed-out'))
      .catch(() => setStatus('signed-out'))
  }, [])

  /**
   * Everything that has to happen when a session ends, whichever way it ends.
   *
   * Both caches, not just one: the in-memory client and the AsyncStorage copy.
   * Leaving the persisted cache behind would repaint the previous user's herd
   * on the next launch, before any request had been made.
   */
  const forget = useCallback(async () => {
    await api.signOut()
    queryClient.clear()
    await clearPersistedCache()
    setStatus('signed-out')
  }, [queryClient])

  // The client has no router. This is how a refresh failure deep in a fetch
  // becomes a navigation.
  useEffect(() => {
    onAuthExpired(() => {
      void forget().then(() => router.replace('/sign-in'))
    })
    return () => onAuthExpired(null)
  }, [forget, router])

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      signIn: async (email, password) => {
        await api.login(email, password)
        // A previous session's cached reads are about a different farm.
        queryClient.clear()
        await clearPersistedCache()
        setStatus('signed-in')
      },
      signOut: forget,
    }),
    [status, forget, queryClient],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used inside AuthProvider')
  return value
}
