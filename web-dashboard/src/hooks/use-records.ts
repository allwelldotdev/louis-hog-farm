'use client'

import { useQuery } from '@tanstack/react-query'

import { apiGet } from '@/lib/api/client'
import type { FeedRecord, HealthRecord, Page } from '@/lib/api/types'
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
