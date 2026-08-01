'use client'

import { useQuery } from '@tanstack/react-query'

import { useFarmMutation } from '@/hooks/use-farm-mutation'
import { apiGet, apiSend } from '@/lib/api/client'
import type { DataVersion, FarmSummary, FarmUpdate } from '@/lib/api/types'
import { queryKeys } from '@/lib/query/keys'

/** The signed-in user's farm — supplies the currency and timezone every other
 *  figure on the page is formatted against. */
export function useFarm() {
  return useQuery({
    queryKey: queryKeys.farm(),
    queryFn: () => apiGet<FarmSummary>('/farms/me'),
  })
}

/** Manager-only, and the name is all the API will change: currency and timezone
 *  are per-deployment, and feed records store the currency at write time. */
export function useUpdateFarm() {
  return useFarmMutation((body: FarmUpdate) => apiSend<FarmSummary>('PATCH', '/farms/me', body))
}

/**
 * The farm's change counter.
 *
 * Twenty seconds is chosen against what the data actually is: farm records are
 * typed in by a person at a keyboard, so anything faster spends requests to
 * shave latency nobody perceives. `refetchOnWindowFocus` covers the case that
 * matters more — coming back to a tab left open over lunch.
 */
export function useDataVersion() {
  return useQuery({
    queryKey: queryKeys.dataVersion(),
    queryFn: () => apiGet<DataVersion>('/meta/data-version'),
    refetchInterval: 20_000,
    refetchOnWindowFocus: true,
    staleTime: 0,
  })
}
