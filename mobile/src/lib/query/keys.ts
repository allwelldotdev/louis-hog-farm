/**
 * Query keys — copied verbatim from `web-dashboard/src/lib/query/keys.ts`.
 *
 * Everything is prefixed `'farm'` so a single
 * `invalidateQueries({ queryKey: queryKeys.root })` covers the whole app: one
 * weigh-in moves the KPI figures, that animal's growth chart and every record
 * list at once, and the person who pressed Save does not wait on the poller.
 *
 * The farm id is deliberately not part of any key. Signing out clears the
 * cache outright, which is simpler than scoping every key to a farm that never
 * changes within a session.
 */
export const queryKeys = {
  root: ['farm'] as const,
  farm: () => ['farm', 'me'] as const,
  currentUser: () => ['farm', 'user'] as const,
  dataVersion: () => ['farm', 'data-version'] as const,
  dashboard: (resource: string, params?: Record<string, unknown>) =>
    ['farm', 'dashboard', resource, params ?? {}] as const,
  list: (resource: string, params?: Record<string, unknown>) =>
    ['farm', 'list', resource, params ?? {}] as const,
  detail: (resource: string, id: number | string) => ['farm', 'detail', resource, id] as const,
}

/** The key segment the data-version poller must never invalidate: itself. */
export const DATA_VERSION_SEGMENT = 'data-version'
