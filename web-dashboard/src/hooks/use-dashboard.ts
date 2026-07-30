'use client'

import { useQuery } from '@tanstack/react-query'

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
 */

export function useKpis() {
  return useQuery({
    queryKey: queryKeys.dashboard('kpis'),
    queryFn: () => apiGet<DashboardKpis>('/dashboard/kpis'),
  })
}

export function useHerdGrowth() {
  return useQuery({
    queryKey: queryKeys.dashboard('herd-growth'),
    queryFn: () => apiGet<HerdGrowth>('/dashboard/herd-growth'),
  })
}

/** Doubles as the breed facet: the filter's options come from this response
 *  rather than a second endpoint that could fall out of step with the data. */
export function useBreedDistribution() {
  return useQuery({
    queryKey: queryKeys.dashboard('breed-distribution'),
    queryFn: () => apiGet<Distribution>('/dashboard/breed-distribution'),
  })
}

export function useProductionClassDistribution() {
  return useQuery({
    queryKey: queryKeys.dashboard('production-class-distribution'),
    queryFn: () => apiGet<Distribution>('/dashboard/production-class-distribution'),
  })
}

export function useWeightDistribution() {
  return useQuery({
    queryKey: queryKeys.dashboard('weight-distribution'),
    queryFn: () => apiGet<WeightDistribution>('/dashboard/weight-distribution'),
  })
}

export function useFeedCostSeries() {
  return useQuery({
    queryKey: queryKeys.dashboard('feed-cost-series'),
    queryFn: () => apiGet<FeedCostSeries>('/dashboard/feed-cost-series'),
  })
}

export type LeaderboardMetric = 'adg' | 'gain' | 'fcr'
export type LeaderboardDirection = 'top' | 'bottom'

export function useLeaderboard(params: {
  metric: LeaderboardMetric
  direction: LeaderboardDirection
  limit: number
}) {
  return useQuery({
    // The params are part of the key, so switching metric reads from cache on
    // the way back rather than refetching a ranking already held.
    queryKey: queryKeys.dashboard('leaderboard', params),
    queryFn: () => apiGet<Leaderboard>('/dashboard/leaderboard', params),
  })
}

/** Deliberately unfiltered by date: an alert raised outside the dashboard's
 *  window and still open is precisely the one worth surfacing. */
export function useAlertSummary() {
  return useQuery({
    queryKey: queryKeys.dashboard('alert-summary'),
    queryFn: () => apiGet<AlertSummary>('/dashboard/alert-summary'),
  })
}
