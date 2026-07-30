/**
 * Cache layer 4: the cache survives a reload.
 *
 * A reload repaints the last known figures immediately and revalidates behind
 * them, instead of showing eight skeletons while eight requests go out. The
 * numbers are at most a moment old and the version poller corrects them.
 *
 * The danger this carries is the reason `clearPersistedCache` exists and is
 * called on sign-out: localStorage outlives the session cookie, so without an
 * explicit purge the next person to use this browser would see the previous
 * farm's figures painted from disk before the first request returns — signed
 * out, and with no request having been authorised.
 */
export const PERSIST_KEY = 'hogfarm-query-cache'

/** A day. Long enough to cover coming back to the dashboard tomorrow morning,
 *  short enough that nothing is restored from a genuinely different herd. */
export const PERSIST_MAX_AGE = 24 * 60 * 60 * 1000

/**
 * Bumped by hand when a cached shape changes. The persisted entries are typed
 * against the API contract, so a regenerated `schema.d.ts` that renames a field
 * would otherwise restore objects the components can no longer read.
 */
export const PERSIST_BUSTER = 'v1'

export function clearPersistedCache() {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(PERSIST_KEY)
}
