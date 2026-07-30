'use client'

import { useQuery } from '@tanstack/react-query'

import { apiGet } from '@/lib/api/client'
import type { DashboardKpis, HerdGrowth } from '@/lib/api/types'
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
