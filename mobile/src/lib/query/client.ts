import AsyncStorage from '@react-native-async-storage/async-storage'
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister'
import { QueryClient } from '@tanstack/react-query'

import { ApiError } from '@/lib/api/errors'
import { DATA_VERSION_SEGMENT } from './keys'

/**
 * Query client and persistence, mirroring
 * `web-dashboard/src/lib/query/{provider,persist}.tsx`.
 *
 * Persistence is the read half of the online-only decision: writes need the
 * network, but the app should still open with last-known figures in a shed
 * with no signal, rather than a screen of spinners.
 */

export const PERSIST_KEY = 'hogfarm-query-cache'
export const PERSIST_MAX_AGE = 24 * 60 * 60 * 1000
export const PERSIST_BUSTER = 'v1'

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: PERSIST_MAX_AGE,
        // A 4xx is an answer, not a hiccup: retrying a 403 three times just
        // makes the user wait longer to be told no.
        retry: (failureCount, error) => {
          if (error instanceof ApiError && error.status >= 400 && error.status < 500) return false
          return failureCount < 2
        },
      },
    },
  })
}

export const persister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: PERSIST_KEY,
})

export const persistOptions = {
  persister,
  maxAge: PERSIST_MAX_AGE,
  buster: PERSIST_BUSTER,
  dehydrateOptions: {
    shouldDehydrateQuery: (query: { state: { status: string }; queryKey: readonly unknown[] }) =>
      // Only successful reads, and never the poller's own key — restoring a
      // stale data-version would suppress exactly the invalidation it exists
      // to trigger.
      query.state.status === 'success' && query.queryKey[1] !== DATA_VERSION_SEGMENT,
  },
}

export async function clearPersistedCache(): Promise<void> {
  await AsyncStorage.removeItem(PERSIST_KEY).catch(() => {})
}
