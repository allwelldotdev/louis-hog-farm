'use client'

import { useQuery } from '@tanstack/react-query'

import { useFarmMutation } from '@/hooks/use-farm-mutation'
import { apiGet, apiSend } from '@/lib/api/client'
import type { MortalityEvent, MortalityEventCreate, Page } from '@/lib/api/types'
import { queryKeys } from '@/lib/query/keys'

const LIMIT = 200

/** Also append-only: `GET` and `POST`, no `PATCH`. */
export function useMortalityEvents(filters: { dateFrom?: string; dateTo?: string } = {}) {
  const params = { date_from: filters.dateFrom, date_to: filters.dateTo, limit: LIMIT }

  return useQuery({
    queryKey: queryKeys.list('mortality-events', params),
    queryFn: () => apiGet<Page<MortalityEvent>>('/mortality-events', params),
  })
}

/** Recording a death also moves the animal to `deceased`, in the same server
 *  transaction — which is why the root invalidation matters here more than
 *  anywhere: the herd count, the mortality tile and the roster all change. */
export function useCreateMortalityEvent() {
  return useFarmMutation((body: MortalityEventCreate) =>
    apiSend<MortalityEvent>('POST', '/mortality-events', body),
  )
}
