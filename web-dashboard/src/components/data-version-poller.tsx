'use client'

import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'

import { useDataVersion } from '@/hooks/use-farm'
import { queryKeys } from '@/lib/query/keys'

/**
 * Layer 2 of the cache story: watch the farm's version counter and invalidate
 * every cached read when it moves.
 *
 * Mounted once, in the app layout. Because all query keys share the `farm`
 * prefix, one invalidation refreshes every chart on the page and nothing else.
 *
 * The version-counter query is excluded from its own invalidation — including
 * it would make each change cost an extra round trip to re-read a number the
 * poller is about to fetch on its own schedule anyway.
 *
 * This is the end of the path that starts with a Postgres trigger: edit a row
 * in psql, and within twenty seconds the page updates without a reload.
 */
export function DataVersionPoller() {
  const queryClient = useQueryClient()
  const { data } = useDataVersion()
  const seen = useRef<number | null>(null)

  useEffect(() => {
    if (!data) return
    if (seen.current !== null && data.version !== seen.current) {
      queryClient.invalidateQueries({
        queryKey: queryKeys.root,
        predicate: (query) => query.queryKey[1] !== 'data-version',
      })
    }
    seen.current = data.version
  }, [data, queryClient])

  return null
}
