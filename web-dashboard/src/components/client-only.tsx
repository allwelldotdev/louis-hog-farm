'use client'

import { useSyncExternalStore } from 'react'

/**
 * Render children only once hydration is done.
 *
 * The dashboard restores its query cache from `localStorage`, which the server
 * cannot see. Without this gate the server emits markup for an empty cache
 * while the client's very first render already has the restored data, and React
 * throws a hydration mismatch — first seen as the breed filter rendering its
 * options on the client and none on the server. Every card would hit the same
 * thing eventually, because every card's markup depends on whether its query
 * has data.
 *
 * The board is client-fetched by design (SPEC § Next.js architecture), so the
 * server render was only ever producing skeletons. Not producing them is no
 * loss, and it removes the whole class of bug rather than patching one card.
 *
 * `useSyncExternalStore` rather than a `useState`/`useEffect` mount flag: its
 * server snapshot is used for SSR *and* for the hydration render, so the two
 * agree by construction. The effect version sets state during an effect, which
 * is the pattern `react-hooks/set-state-in-effect` exists to reject.
 */
const subscribe = () => () => {}
const getSnapshot = () => false
const getServerSnapshot = () => true

export function ClientOnly({
  fallback = null,
  children,
}: {
  fallback?: React.ReactNode
  children: React.ReactNode
}) {
  const isServerRender = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  return <>{isServerRender ? fallback : children}</>
}
