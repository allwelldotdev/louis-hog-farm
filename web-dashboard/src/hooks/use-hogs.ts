'use client'

import { useQuery } from '@tanstack/react-query'

import { toQueryParams, useDashboardFilters } from '@/hooks/use-dashboard-filters'
import { apiGet } from '@/lib/api/client'
import type { Hog, Page } from '@/lib/api/types'
import { queryKeys } from '@/lib/query/keys'

/**
 * The herd, in one request.
 *
 * `limit` is the API's maximum. A farm's roster is small enough that fetching
 * it whole and sorting in the browser beats a round trip per column click, and
 * the facets are applied server-side so narrowing genuinely reduces the set
 * rather than just hiding rows. Past the ceiling the table says so instead of
 * quietly truncating — see `HogsTable`.
 */
export const HOGS_PAGE_LIMIT = 200

export function useHogs() {
  const { filters } = useDashboardFilters()
  const params = toQueryParams(filters, ['breed', 'status', 'production_class'])
  const query = { ...params, limit: HOGS_PAGE_LIMIT }

  return useQuery({
    queryKey: queryKeys.list('hogs', query),
    queryFn: () => apiGet<Page<Hog>>('/hogs', query),
  })
}
