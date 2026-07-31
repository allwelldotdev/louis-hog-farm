'use client'

import { useQuery } from '@tanstack/react-query'

import { toQueryParams, useDashboardFilters } from '@/hooks/use-dashboard-filters'
import { apiGet } from '@/lib/api/client'
import type { GrowthSeries, Hog, Page, ProductionClass } from '@/lib/api/types'
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

/**
 * The unfiltered roster, shared by everything that needs to know the herd
 * rather than the current view.
 *
 * Deliberately not `useHogs()`: that one reads the page's URL facets, so a
 * picker or a tag lookup built on it would change meaning depending on what the
 * table beside it happened to be filtered to.
 */
function useRoster() {
  const params = { limit: HOGS_PAGE_LIMIT }

  return useQuery({
    queryKey: queryKeys.list('hogs', params),
    queryFn: () => apiGet<Page<Hog>>('/hogs', params),
  })
}

/**
 * Animals a record can be written against — active only, since a record for an
 * archived or dead animal is not a thing anyone means to enter.
 *
 * `productionClasses` narrows it further for breeding, where the API rejects a
 * cycle with 400 unless the hog is a sow or gilt.
 */
export function useHogPicker(productionClasses?: readonly ProductionClass[]) {
  const query = useRoster()

  const options = (query.data?.items ?? [])
    .filter((hog) => hog.status === 'active')
    .filter((hog) => !productionClasses || productionClasses.includes(hog.production_class))
    .sort((a, b) => a.tag_number.localeCompare(b.tag_number))

  return { ...query, options }
}

/**
 * `hog_id` → tag number, for the record tables.
 *
 * Records carry only the id, and a table of raw ids is unreadable to anyone who
 * knows the animals by their ear tags. Built from the whole roster rather than
 * the active subset: a record written before an animal was archived still has
 * to name it.
 */
export function useHogTags(): Map<number, string> {
  const query = useRoster()
  return new Map((query.data?.items ?? []).map((hog) => [hog.id, hog.tag_number]))
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
