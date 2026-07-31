'use client'

import { useQuery } from '@tanstack/react-query'

import { useFarmMutation } from '@/hooks/use-farm-mutation'
import { apiGet, apiSend } from '@/lib/api/client'
import type { BreedingCycle, BreedingCycleCreate, BreedingCycleUpdate, Page } from '@/lib/api/types'
import { queryKeys } from '@/lib/query/keys'

const LIMIT = 200

export function useBreedingCycles(hogId?: number) {
  const params = { hog_id: hogId, limit: LIMIT }

  return useQuery({
    queryKey: queryKeys.list('breeding-cycles', params),
    queryFn: () => apiGet<Page<BreedingCycle>>('/breeding-cycles', params),
  })
}

export function useCreateBreedingCycle() {
  return useFarmMutation((body: BreedingCycleCreate) =>
    apiSend<BreedingCycle>('POST', '/breeding-cycles', body),
  )
}

/**
 * Closing a cycle.
 *
 * The API allows a status change only from `ongoing`, and only to `completed`
 * or `aborted` — and once closed, nothing but the notes can be edited. That is
 * why the table offers "Close" on ongoing rows alone rather than a general edit
 * affordance that would be refused most of the time.
 */
export function useUpdateBreedingCycle() {
  return useFarmMutation(({ id, ...body }: BreedingCycleUpdate & { id: number }) =>
    apiSend<BreedingCycle>('PATCH', `/breeding-cycles/${id}`, body),
  )
}
