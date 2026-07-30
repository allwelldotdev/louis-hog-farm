'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'

import { ApiError } from '@/lib/api/client'

/**
 * One QueryClient per browser session, created inside state so a re-render
 * never swaps it out and loses the cache.
 *
 * `staleTime` is 30s against a 20s version poll: the poller is what decides
 * when data is stale, and a shorter staleTime would just add refetches the
 * poller has not asked for.
 */
export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: true,
            retry: (failureCount, error) => {
              // A 401 means the session is over and the passthrough route has
              // already tried refreshing. Retrying just delays the redirect.
              if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
                return false
              }
              return failureCount < 2
            },
          },
        },
      }),
  )

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}
