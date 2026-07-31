'use client'

import { useQuery } from '@tanstack/react-query'

import { apiGet } from '@/lib/api/client'
import type { Page, UserRead } from '@/lib/api/types'
import { queryKeys } from '@/lib/query/keys'

/**
 * The farm's staff roster. Manager-only at the API, so the caller must gate on
 * `canManage`; `enabled` keeps a worker's session from firing a request that
 * can only answer 403.
 */
export function useUsers(enabled: boolean) {
  const params = { limit: 200 }

  return useQuery({
    queryKey: queryKeys.list('users', params),
    queryFn: () => apiGet<Page<UserRead>>('/users', params),
    enabled,
  })
}
