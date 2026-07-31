'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { apiGet, apiSend } from '@/lib/api/client'
import type {
  FeedRecord,
  FeedRecordCreate,
  HealthRecord,
  HealthRecordCreate,
  Page,
} from '@/lib/api/types'
import { queryKeys } from '@/lib/query/keys'

/**
 * Feed and health records.
 *
 * Both endpoints return newest first and take the same three filters, so they
 * are one shape with two paths rather than two hooks that drift.
 */
export type RecordFilters = {
  hogId?: number
  dateFrom?: string
  dateTo?: string
  limit?: number
}

const DEFAULT_LIMIT = 200

function toParams(filters: RecordFilters): Record<string, string | number | undefined> {
  return {
    hog_id: filters.hogId,
    date_from: filters.dateFrom,
    date_to: filters.dateTo,
    limit: filters.limit ?? DEFAULT_LIMIT,
  }
}

export function useHealthRecords(filters: RecordFilters = {}) {
  const params = toParams(filters)

  return useQuery({
    queryKey: queryKeys.list('health-records', params),
    queryFn: () => apiGet<Page<HealthRecord>>('/health-records', params),
  })
}

export function useFeedRecords(filters: RecordFilters = {}) {
  const params = toParams(filters)

  return useQuery({
    queryKey: queryKeys.list('feed-records', params),
    queryFn: () => apiGet<Page<FeedRecord>>('/feed-records', params),
  })
}

/**
 * Invalidate everything under `farm`, not just the list that changed.
 *
 * One feed record moves the KPI row, the feed-cost chart, the leaderboard and
 * that animal's detail page. The data-version poller would catch all of it
 * within twenty seconds, but the person who just pressed Save should not have
 * to wait for a poll to see their own entry — and enumerating the affected keys
 * per mutation is a list that goes stale the moment a chart is added.
 */
function useFarmMutation<TInput, TResult>(send: (input: TInput) => Promise<TResult>) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: send,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.root }),
  })
}

export function useCreateHealthRecord() {
  return useFarmMutation((body: HealthRecordCreate) =>
    apiSend<HealthRecord>('POST', '/health-records', body),
  )
}

export function useCreateFeedRecord() {
  // `currency_code` is deliberately absent: the API fills it from the farm and
  // `FeedRecordCreate` does not carry the field at all (audit i).
  return useFarmMutation((body: FeedRecordCreate) =>
    apiSend<FeedRecord>('POST', '/feed-records', body),
  )
}
