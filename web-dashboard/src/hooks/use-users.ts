'use client'

import { useQuery } from '@tanstack/react-query'

import { useFarmMutation } from '@/hooks/use-farm-mutation'
import { apiGet, apiSend } from '@/lib/api/client'
import type { Page, UserCreateStaff, UserRead, UserRole } from '@/lib/api/types'
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

/** Manager-only. The API forces the new account onto the manager's own farm and
 *  refuses any role but worker or viewer. */
export function useCreateUser() {
  return useFarmMutation((body: UserCreateStaff) => apiSend<UserRead>('POST', '/users', body))
}

/**
 * Manager-only. The API refuses to change your own role or another manager's,
 * because nothing in the app can promote anyone back to manager — the roster
 * gates both cases so neither renders a control that can only answer 400/403.
 */
export function useUpdateUserRole() {
  return useFarmMutation(({ id, role }: { id: number; role: UserRole }) =>
    apiSend<UserRead>('PATCH', `/users/${id}`, { role }),
  )
}
