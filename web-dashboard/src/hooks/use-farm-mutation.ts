'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'

import { queryKeys } from '@/lib/query/keys'

/**
 * Every write in the app goes through this.
 *
 * It invalidates everything under `farm`, not just the list that changed. One
 * feed record moves the KPI row, the feed-cost chart, the leaderboard and that
 * animal's detail page; a mortality event moves the herd count, the mortality
 * tile and the roster. The data-version poller would catch all of it within
 * twenty seconds, but the person who just pressed Save should not have to wait
 * for a poll to see their own entry — and a per-mutation list of affected keys
 * is a list that goes stale the moment a chart is added.
 */
export function useFarmMutation<TInput, TResult>(send: (input: TInput) => Promise<TResult>) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: send,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.root }),
  })
}
