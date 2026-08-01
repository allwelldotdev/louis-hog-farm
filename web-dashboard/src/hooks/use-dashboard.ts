'use client'

import { useQuery } from '@tanstack/react-query'

import { toQueryParams, useDashboardFilters } from '@/hooks/use-dashboard-filters'
import { apiGet } from '@/lib/api/client'
import type {
  AlertSummary,
  DashboardKpis,
  Distribution,
  FeedCostSeries,
  HerdGrowth,
  Leaderboard,
  WeightDistribution,
} from '@/lib/api/types'
import { queryKeys } from '@/lib/query/keys'

/**
 * One thin hook per dashboard endpoint.
 *
 * None of them configure invalidation: every key is built by `queryKeys.dashboard`
 * and therefore sits under the `farm` prefix the data-version poller invalidates
 * wholesale. A chart added here is refreshed by a Postgres trigger with no
 * wiring of its own.
 *
 * Each reads the URL filters itself rather than taking them as a prop, so no
 * chart can end up rendering a different window from the one beside it. The
 * params are part of the query key, which means changing a filter and changing
 * back is a cache read rather than a refetch. Each hook asks only for the
 * parameters its route declares — sending one an endpoint ignores would split
 * that endpoint's cache key for nothing.
 */

export function useKpis() {
  const { filters } = useDashboardFilters()
  const params = toQueryParams(filters, ['date_from', 'date_to', 'breed'])

  return useQuery({
    queryKey: queryKeys.dashboard('kpis', params),
    queryFn: () => apiGet<DashboardKpis>('/dashboard/kpis', params),
  })
}

export function useHerdGrowth() {
  const { filters } = useDashboardFilters()
  const params = toQueryParams(filters, ['date_from', 'date_to', 'breed'])

  return useQuery({
    queryKey: queryKeys.dashboard('herd-growth', params),
    queryFn: () => apiGet<HerdGrowth>('/dashboard/herd-growth', params),
  })
}

/**
 * Doubles as the breed facet: the filter's options come from this response
 * rather than a second endpoint that could fall out of step with the data.
 *
 * Deliberately not breed-filtered — filtering the facet by the current
 * selection would leave the dropdown holding exactly one option and no way back.
 */
export function useBreedDistribution() {
  const { filters } = useDashboardFilters()
  const params = toQueryParams(filters, ['date_from', 'date_to'])

  return useQuery({
    queryKey: queryKeys.dashboard('breed-distribution', params),
    queryFn: () => apiGet<Distribution>('/dashboard/breed-distribution', params),
  })
}

export function useProductionClassDistribution() {
  const { filters } = useDashboardFilters()
  const params = toQueryParams(filters, ['date_from', 'date_to', 'breed'])

  return useQuery({
    queryKey: queryKeys.dashboard('production-class-distribution', params),
    queryFn: () => apiGet<Distribution>('/dashboard/production-class-distribution', params),
  })
}

export function useWeightDistribution() {
  const { filters } = useDashboardFilters()
  // A histogram of each hog's *latest* weight has no start date to honour.
  const params = toQueryParams(filters, ['date_to', 'breed'])

  return useQuery({
    queryKey: queryKeys.dashboard('weight-distribution', params),
    queryFn: () => apiGet<WeightDistribution>('/dashboard/weight-distribution', params),
  })
}

export function useFeedCostSeries() {
  const { filters } = useDashboardFilters()
  const params = toQueryParams(filters, ['date_from', 'date_to', 'breed'])

  return useQuery({
    queryKey: queryKeys.dashboard('feed-cost-series', params),
    queryFn: () => apiGet<FeedCostSeries>('/dashboard/feed-cost-series', params),
  })
}

export type LeaderboardMetric = 'adg' | 'gain' | 'fcr'
export type LeaderboardDirection = 'top' | 'bottom'

export function useLeaderboard(options: {
  metric: LeaderboardMetric
  direction: LeaderboardDirection
  limit: number
}) {
  const { filters } = useDashboardFilters()
  const params = { ...toQueryParams(filters, ['date_from', 'date_to', 'breed']), ...options }

  return useQuery({
    queryKey: queryKeys.dashboard('leaderboard', params),
    queryFn: () => apiGet<Leaderboard>('/dashboard/leaderboard', params),
  })
}

/** Deliberately unfiltered: an alert raised outside the dashboard's window and
 *  still open is precisely the one worth surfacing. */
export function useAlertSummary() {
  return useQuery({
    queryKey: queryKeys.dashboard('alert-summary'),
    queryFn: () => apiGet<AlertSummary>('/dashboard/alert-summary'),
  })
}
