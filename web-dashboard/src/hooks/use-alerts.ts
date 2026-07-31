'use client'

import { useQuery } from '@tanstack/react-query'

import { useFarmMutation } from '@/hooks/use-farm-mutation'
import { apiGet, apiSend } from '@/lib/api/client'
import type { Alert, AlertStatus, Page } from '@/lib/api/types'
import { queryKeys } from '@/lib/query/keys'

const LIMIT = 200

export function useAlerts(filters: { status?: string; alertType?: string } = {}) {
  const params = { status: filters.status, alert_type: filters.alertType, limit: LIMIT }

  return useQuery({
    queryKey: queryKeys.list('alerts', params),
    queryFn: () => apiGet<Page<Alert>>('/alerts', params),
  })
}

/** Acknowledge or resolve. Manager-only server-side, so the row actions are
 *  gated on `canManage` rather than `canWrite`. */
export function useUpdateAlert() {
  return useFarmMutation(
    ({ id, ...body }: { id: number; status: AlertStatus; resolution_notes?: string | null }) =>
      apiSend<Alert>('PATCH', `/alerts/${id}`, body),
  )
}
