/**
 * Query keys.
 *
 * Every key starts with `farm`, so the data-version poller can invalidate the
 * whole page's worth of cached reads with a single call rather than listing
 * each chart. The signed-in user belongs to exactly one farm, so the farm id
 * is not part of the key — the cache is cleared outright on sign-out, which is
 * what stops the next person seeing the previous farm's numbers.
 */
export const queryKeys = {
  root: ['farm'] as const,
  farm: () => ['farm', 'me'] as const,
  dataVersion: () => ['farm', 'data-version'] as const,
  dashboard: (resource: string, params?: Record<string, unknown>) =>
    ['farm', 'dashboard', resource, params ?? {}] as const,
  list: (resource: string, params?: Record<string, unknown>) =>
    ['farm', 'list', resource, params ?? {}] as const,
}
