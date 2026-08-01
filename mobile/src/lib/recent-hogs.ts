/**
 * The last few animals this device recorded against.
 *
 * Weighing a pen means touching the same handful of ear tags in a row, and
 * hunting a 60-row list for each one is the difference between a workflow and
 * a chore. Pure list logic here; the storage read/write lives in the hook.
 */

export const RECENT_HOGS_KEY = 'hogfarm:recent-hogs'
export const RECENT_HOGS_LIMIT = 5

/** Most-recent-first, no duplicates, capped. */
export function pushRecent(ids: number[], id: number, limit = RECENT_HOGS_LIMIT): number[] {
  return [id, ...ids.filter((existing) => existing !== id)].slice(0, limit)
}

/** Parse whatever was in storage, discarding anything that is not an id. */
export function parseRecent(raw: string | null | undefined): number[] {
  if (!raw) return []
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
      .slice(0, RECENT_HOGS_LIMIT)
  } catch {
    return []
  }
}
