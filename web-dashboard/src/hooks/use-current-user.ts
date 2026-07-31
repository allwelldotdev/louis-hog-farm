'use client'

import { useQuery } from '@tanstack/react-query'

import { apiGet } from '@/lib/api/client'
import type { UserRead } from '@/lib/api/types'
import { canManage, canWrite } from '@/lib/auth/permissions'
import { queryKeys } from '@/lib/query/keys'

/** The signed-in user. Carries the role every write affordance is gated on. */
export function useCurrentUser() {
  return useQuery({
    queryKey: queryKeys.currentUser(),
    queryFn: () => apiGet<UserRead>('/users/me'),
  })
}

/**
 * What the signed-in user is allowed to do, for gating buttons and forms.
 *
 * Both flags are false while the request is in flight, so nothing writable
 * flashes before the role is known.
 */
export function usePermissions() {
  const { data, isPending } = useCurrentUser()
  const role = data?.role

  return {
    role,
    isPending,
    canWrite: canWrite(role),
    canManage: canManage(role),
  }
}
