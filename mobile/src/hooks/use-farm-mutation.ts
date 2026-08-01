import { useMutation, useQueryClient } from '@tanstack/react-query'

import { queryKeys } from '@/lib/query/keys'

/**
 * Every write in the app goes through here.
 *
 * A verbatim port of `web-dashboard/src/hooks/use-farm-mutation.ts`, including
 * the decision to invalidate *everything* rather than a per-mutation key list.
 * One weigh-in legitimately moves the KPI figures, that animal's growth
 * sparkline and two record lists, and enumerating that per call site is a list
 * that goes stale the first time a screen is added.
 */
export function useFarmMutation<TResult, TInput>(mutationFn: (input: TInput) => Promise<TResult>) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.root }),
  })
}
