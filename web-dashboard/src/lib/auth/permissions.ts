import type { UserRole } from '@/lib/api/types'

/**
 * The client-side mirror of the backend's `require_not_viewer` and
 * `require_manager` dependencies (`backend/app/api/deps.py`).
 *
 * The server is still the authority — this only decides whether an affordance
 * renders. The point is that a viewer never sees a button that answers 403,
 * which is the worst version of a permissions system: the rule exists but only
 * the server knows it.
 *
 * `undefined` is the "we do not know yet" case and always denies. A write
 * button that appears for a moment while `/users/me` is in flight is a button
 * a viewer can click.
 */
export function canWrite(role: UserRole | undefined): boolean {
  return role !== undefined && role !== 'viewer'
}

export function canManage(role: UserRole | undefined): boolean {
  return role === 'manager' || role === 'admin'
}

export const ROLE_LABELS: Record<UserRole, string> = {
  manager: 'Manager',
  admin: 'Admin',
  worker: 'Worker',
  viewer: 'Viewer',
}
