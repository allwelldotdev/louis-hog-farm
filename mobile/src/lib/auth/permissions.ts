import type { UserRole } from '@/lib/api/types'

/**
 * Ported verbatim from `web-dashboard/src/lib/auth/permissions.ts`.
 *
 * The client-side mirror of the backend's `require_not_viewer` and
 * `require_manager` dependencies (`backend/app/api/deps.py`). The server is
 * still the authority; this only decides how an affordance renders.
 *
 * **The predicates must not diverge from the web's.** Two clients of one API
 * disagreeing about who may do what is worse than either being wrong alone.
 * What the mobile app changes is only the *presentation* of a denial: the
 * dashboard removes the control, this app shows it locked (see
 * `src/components/ui/locked.tsx`), because a worker who cannot see a
 * capability cannot know to ask their manager for it.
 *
 * `undefined` is the "we do not know yet" case and always denies — a write
 * button that appears for a moment while `/users/me` is in flight is a button
 * someone can tap.
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

/**
 * The roles a manager may hand out, mirroring `STAFF_ROLES` in
 * `backend/app/schemas/user.py`. `manager` is excluded so a farm cannot grow a
 * second administrator by accident, and `admin` is reachable by no code path.
 */
export const STAFF_ROLES = ['worker', 'viewer'] as const satisfies readonly UserRole[]

/**
 * Whether this account's role can be changed from the settings roster.
 *
 * Mirrors the two guards on `PATCH /users/{id}`: never your own role, and never
 * a manager's or admin's. Both exist because nothing in the app can promote
 * anyone *back* to manager, so a demotion would be a one-way door.
 */
export function canChangeRoleOf(
  target: { id: number; role: UserRole },
  currentUserId: number | undefined,
): boolean {
  return target.id !== currentUserId && !canManage(target.role)
}
