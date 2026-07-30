'use client'

import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister'
import { QueryClient } from '@tanstack/react-query'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { useState } from 'react'

import { ApiError } from '@/lib/api/client'
import { PERSIST_BUSTER, PERSIST_KEY, PERSIST_MAX_AGE } from '@/lib/query/persist'

/**
 * One QueryClient per browser session, created inside state so a re-render
 * never swaps it out and loses the cache.
 *
 * `staleTime` is 30s against a 20s version poll: the poller is what decides
 * when data is stale, and a shorter staleTime would just add refetches the
 * poller has not asked for.
 *
 * `gcTime` has to be at least the persisted `maxAge`, or entries are collected
 * out of memory before they are ever written and the persisted cache stays
 * mysteriously empty.
 */
export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            gcTime: PERSIST_MAX_AGE,
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

  // Built lazily: `localStorage` does not exist while this renders on the
  // server, and reaching for it there throws during hydration.
  const [persister] = useState(() =>
    createSyncStoragePersister({
      storage: typeof window === 'undefined' ? undefined : window.localStorage,
      key: PERSIST_KEY,
    }),
  )

  return (
    <PersistQueryClientProvider
      client={client}
      persistOptions={{
        persister,
        maxAge: PERSIST_MAX_AGE,
        buster: PERSIST_BUSTER,
        dehydrateOptions: {
          // Only successful reads are worth restoring. Persisting an error
          // would repaint yesterday's failure before today's request is even
          // sent, and the version counter is refetched on mount regardless.
          shouldDehydrateQuery: (query) =>
            query.state.status === 'success' && query.queryKey[1] !== 'data-version',
        },
      }}
    >
      {children}
    </PersistQueryClientProvider>
  )
}
