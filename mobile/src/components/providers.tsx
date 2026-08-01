import { focusManager, type QueryClient } from '@tanstack/react-query'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { useEffect, useState, type ReactNode } from 'react'
import { AppState, type AppStateStatus } from 'react-native'

import { api } from '@/api-runtime'
import { createQueryClient, persistOptions } from '@/lib/query/client'

/**
 * Query provider plus the two RN equivalents of things the browser gives the
 * dashboard for free.
 */
export function QueryProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState<QueryClient>(() => createQueryClient())

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (status: AppStateStatus) => {
      const active = status === 'active'
      // The stand-in for `refetchOnWindowFocus`. It also gates the 20s poller,
      // which is what stops it running while the phone is in a pocket.
      focusManager.setFocused(active)

      // The 30-minute access token versus a phone that slept: refresh *before*
      // the first query fires, so returning to the app does not spend a
      // visible failed round trip — and, if the first action is a form submit,
      // does not stall behind a spinner. Single-flighted inside the client, so
      // this racing with a real request is harmless.
      if (active) api.ensureFreshToken().catch(() => {})
    })
    return () => subscription.remove()
  }, [])

  return (
    <PersistQueryClientProvider client={queryClient} persistOptions={persistOptions}>
      {children}
    </PersistQueryClientProvider>
  )
}
