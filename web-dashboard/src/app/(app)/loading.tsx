/**
 * The only `loading.tsx` in the app.
 *
 * Not about data: every page under `(app)` already renders its own skeleton
 * behind `<Suspense><ClientOnly>`, and the data is fetched in the browser where
 * this file never sees it. It is about the router — without a loading boundary
 * App Router holds the current page until the next segment's payload lands, so a
 * click on the sidebar does nothing visible. With one, the shell stays put and
 * the body swaps immediately.
 *
 * It also covers the one real server await in this group: the layout reads the
 * session cookie through `next/headers`.
 *
 * Deliberately not repeated per segment. Eleven copies of this same block would
 * each cover a server render that awaits nothing.
 */
export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="h-3 w-16 animate-pulse rounded bg-raised" />
        <div className="h-6 w-40 animate-pulse rounded bg-raised" />
      </div>
      <div className="h-96 animate-pulse rounded-card bg-surface" />
    </div>
  )
}
