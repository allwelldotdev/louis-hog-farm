import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'

import { api } from '@/api-runtime'
import type { Alert, Hog, HogGrowth, Page } from '@/lib/api/types'
import { queryKeys } from '@/lib/query/keys'

/**
 * The API's ceiling (`MAX_LIMIT` in `backend/app/api/pagination.py`), and the
 * same value the dashboard's roster asks for.
 *
 * Every hog in one request, filtered on the device. That is not laziness: the
 * hog endpoint filters by `status`, `breed` and `production_class` but has no
 * text search, so matching a partly-remembered ear tag has to happen locally
 * either way. A farm past 200 gets an honest note rather than silent
 * truncation.
 */
export const HOGS_PAGE_LIMIT = 200

export function useHogs(params?: { status?: string }) {
  return useQuery({
    queryKey: queryKeys.list('hogs', { limit: HOGS_PAGE_LIMIT, ...params }),
    queryFn: () => api.get<Page<Hog>>('/hogs', { limit: HOGS_PAGE_LIMIT, ...params }),
  })
}

export function useHog(hogId: number) {
  return useQuery({
    queryKey: queryKeys.detail('hogs', hogId),
    queryFn: () => api.get<Hog>(`/hogs/${hogId}`),
    enabled: Number.isFinite(hogId),
  })
}

export function useHogGrowth(hogId: number) {
  return useQuery({
    queryKey: queryKeys.detail('hog-growth', hogId),
    queryFn: () => api.get<HogGrowth>(`/hogs/${hogId}/growth`),
    enabled: Number.isFinite(hogId),
  })
}

export function useAlerts(params?: { status?: string }) {
  return useQuery({
    queryKey: queryKeys.list('alerts', params),
    queryFn: () => api.get<Page<Alert>>('/alerts', { limit: 50, ...params }),
  })
}

/**
 * hog id -> ear tag.
 *
 * Alerts, mortality events and breeding cycles all carry `hog_id` and nothing
 * else, but "hog 47" means nothing to anyone; the ear tag is what is written
 * on the animal. The dashboard resolves this the same way, off the roster it
 * has already fetched.
 */
export function useHogTags(): Map<number, string> {
  const { data } = useHogs()
  return useMemo(() => {
    const map = new Map<number, string>()
    for (const hog of data?.items ?? []) map.set(hog.id, hog.tag_number)
    return map
  }, [data])
}
