'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useMemo } from 'react'

/**
 * The dashboard's filters, held in the URL rather than in React state.
 *
 * The URL is the right home for them: a filtered view can be linked, bookmarked
 * and reloaded, the back button steps through what was actually looked at, and
 * a figure quoted in the report has an address that reproduces it. Component
 * state would make all of that impossible and buy nothing.
 *
 * Every dashboard hook reads this rather than receiving it as a prop, which is
 * what stops one chart quietly rendering a different window from the rest.
 */

export type DashboardFilters = {
  dateFrom?: string
  dateTo?: string
  breed?: string
}

/** Snake_case in the URL to match the API's own parameter names — two spellings
 *  of the same filter is a bug waiting to happen. */
const PARAM = {
  dateFrom: 'date_from',
  dateTo: 'date_to',
  breed: 'breed',
} as const

export function useDashboardFilters() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  const filters = useMemo<DashboardFilters>(
    () => ({
      dateFrom: searchParams.get(PARAM.dateFrom) ?? undefined,
      dateTo: searchParams.get(PARAM.dateTo) ?? undefined,
      breed: searchParams.get(PARAM.breed) ?? undefined,
    }),
    [searchParams],
  )

  const setFilters = useCallback(
    (next: Partial<DashboardFilters>) => {
      const params = new URLSearchParams(searchParams.toString())

      for (const [key, value] of Object.entries(next) as [keyof DashboardFilters, string][]) {
        // An empty control means "no filter", which is the absence of the
        // parameter — not `?breed=`, which the API would read as a breed named
        // the empty string.
        if (value) params.set(PARAM[key], value)
        else params.delete(PARAM[key])
      }

      const query = params.toString()
      // `replace`, not `push`: dragging a date picker through six values should
      // not bury the previous page under six history entries.
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
    },
    [pathname, router, searchParams],
  )

  const isFiltered = Boolean(filters.dateFrom || filters.dateTo || filters.breed)

  return { filters, setFilters, isFiltered }
}

/** The filter subset an endpoint accepts, in the API's own spelling. Endpoints
 *  ignore what they are not given, but sending a parameter a route does not
 *  declare would split its cache key for no reason. */
export function toQueryParams(
  filters: DashboardFilters,
  accepts: readonly ('date_from' | 'date_to' | 'breed')[],
): Record<string, string | undefined> {
  const all = {
    date_from: filters.dateFrom,
    date_to: filters.dateTo,
    breed: filters.breed,
  }
  return Object.fromEntries(accepts.map((key) => [key, all[key]]))
}
