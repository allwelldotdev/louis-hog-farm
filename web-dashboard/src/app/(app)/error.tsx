'use client'

import { useEffect } from 'react'

import { Button } from '@/components/ui/button'

/**
 * A backstop, not the error UI.
 *
 * Fetch failures never reach here — every view renders its own error card from
 * TanStack Query state, which is the right place for them because only the view
 * knows what "try again" means. What reaches here is a render-time throw: a
 * chart handed a shape it cannot draw, a route param that resolves to nothing.
 * Without this file those are a blank page in production.
 *
 * `reset()` re-renders the segment without discarding the query cache, so a
 * transient crash costs a re-render rather than a full refetch of the board.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="mx-auto max-w-md space-y-4 py-16">
      <p className="eyebrow">Error</p>
      <h1 className="text-xl font-semibold tracking-tight text-ink">This page stopped rendering</h1>
      <p className="text-sm text-muted">
        Nothing was written, so the data is safe. Try again — and if it keeps happening, the digest
        below identifies this failure in the server log.
      </p>
      {error.digest ? <p className="figure text-xs text-muted">{error.digest}</p> : null}
      <Button variant="outline" size="sm" onClick={reset}>
        Try again
      </Button>
    </div>
  )
}
