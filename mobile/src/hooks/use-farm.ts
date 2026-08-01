import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'

import { api } from '@/api-runtime'
import type { DashboardKpis, DataVersionResponse, FarmSummary, UserRead } from '@/lib/api/types'
import { deviceToday } from '@/lib/format'
import { DATA_VERSION_SEGMENT, queryKeys } from '@/lib/query/keys'
import { canManage, canWrite } from '@/lib/auth/permissions'

export function useCurrentUser() {
  return useQuery({
    queryKey: queryKeys.currentUser(),
    queryFn: () => api.get<UserRead>('/users/me'),
  })
}

export function useFarm() {
  return useQuery({
    queryKey: queryKeys.farm(),
    queryFn: () => api.get<FarmSummary>('/farms/me'),
  })
}

/**
 * The role gate every screen reads.
 *
 * `isPending` is exposed so a screen can tell "not allowed" from "not known
 * yet" — though both deny, because `canWrite(undefined)` is false.
 */
export function usePermissions() {
  const { data, isPending } = useCurrentUser()
  const role = data?.role
  return { role, isPending, canWrite: canWrite(role), canManage: canManage(role) }
}

export function useKpis() {
  return useQuery({
    queryKey: queryKeys.dashboard('kpis'),
    queryFn: () => api.get<DashboardKpis>('/dashboard/kpis'),
  })
}

/**
 * Today's date **at the farm**, as `YYYY-MM-DD`.
 *
 * The backend rejects a future `record_date` against `farm_today(timezone)`,
 * and computing that on the phone would mean `Intl` with an arbitrary zone
 * under Hermes *and* trusting the clock on a shared barn phone. But
 * `GET /dashboard/kpis` already returns `date_to` computed in the farm's
 * timezone, and Today fetches it anyway — so the server answers its own
 * question and the whole class of off-by-one disappears.
 *
 * The device date is only the fallback for the moment before that lands.
 */
export function useFarmToday(): string {
  const { data } = useKpis()
  return data?.date_to ?? deviceToday()
}

/**
 * Poll the farm's data version and invalidate everything when it moves.
 *
 * A verbatim port of the dashboard's poller. The counter is bumped by Postgres
 * statement-level triggers on every write, by anyone — so a manager editing on
 * the web moves the number and this phone repaints, which is the same
 * mechanism that makes a mobile write show up on the dashboard.
 */
export function useDataVersionPoller() {
  const queryClient = useQueryClient()
  const lastSeen = useRef<number | null>(null)

  const { data } = useQuery({
    queryKey: queryKeys.dataVersion(),
    queryFn: () => api.get<DataVersionResponse>('/meta/data-version'),
    refetchInterval: 20_000,
    // Left at its default (false) deliberately: a 20-second poll from a
    // backgrounded app is a battery and data drain for nothing anyone can see.
    refetchIntervalInBackground: false,
    staleTime: 0,
  })

  const version = data?.version ?? null

  useEffect(() => {
    if (version === null) return
    if (lastSeen.current === null) {
      lastSeen.current = version
      return
    }
    if (version !== lastSeen.current) {
      lastSeen.current = version
      queryClient.invalidateQueries({
        queryKey: queryKeys.root,
        // Never itself — invalidating the poller's own key would make it
        // refetch, see a change, and invalidate again.
        predicate: (query) => query.queryKey[1] !== DATA_VERSION_SEGMENT,
      })
    }
  }, [version, queryClient])
}
