'use client'

import { useQuery } from '@tanstack/react-query'

import { toQueryParams, useDashboardFilters } from '@/hooks/use-dashboard-filters'
import { apiGet } from '@/lib/api/client'
import type { GrowthSeries, Hog, Page } from '@/lib/api/types'
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

export function useHog(hogId: number) {
  return useQuery({
    queryKey: queryKeys.detail('hogs', hogId),
    queryFn: () => apiGet<Hog>(`/hogs/${hogId}`),
  })
}

/** One animal's weigh-ins over time — the only per-animal series the API has,
 *  and what makes an individual's stall or decline visible at all. The herd
 *  charts draw aggregates, which is precisely where those shapes disappear. */
export function useHogGrowth(hogId: number) {
  return useQuery({
    queryKey: queryKeys.detail('hog-growth', hogId),
    queryFn: () => apiGet<GrowthSeries>(`/hogs/${hogId}/growth`),
  })
}
