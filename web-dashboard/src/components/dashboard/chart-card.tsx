'use client'

import type { UseQueryResult } from '@tanstack/react-query'
import { RefreshCw } from 'lucide-react'
import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { formatRelative } from '@/lib/format'
import { cn } from '@/lib/utils'

/**
 * The frame every analytical component on the dashboard wears.
 *
 * It owns the four behaviours that would otherwise be reimplemented per chart:
 * a refresh button wired to `refetch()`, a spinner while `isFetching`, an
 * "Updated {relative}" footer read from `dataUpdatedAt`, and the pending /
 * error / empty states. Nine charts each inventing their own version of that is
 * exactly the drift this exists to prevent.
 *
 * Refresh is not a no-op even when the data has not changed: the request goes
 * out with `If-None-Match` and comes back a bodyless 304, so the button costs a
 * couple of hundred bytes rather than a six-query recompute. That is the point
 * of the ETag layer, and this is the control that exercises it.
 */

/** The header shows a live clock; a footer rendered once would keep claiming
 *  "updated just now" for as long as the tab stays open. */
const TICK_MS = 30_000

function useTick(intervalMs: number): number {
  const [tick, setTick] = useState(0)

  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])

  return tick
}

type ChartCardProps<TData> = {
  title: string
  /** One line under the title: what the figures mean, or the window they cover. */
  hint?: string
  query: UseQueryResult<TData, Error>
  /** True when the request succeeded but the series holds nothing worth drawing. */
  isEmpty?: boolean
  emptyMessage?: string
  /** Controls belonging to this card — an interval switch, a metric selector. */
  actions?: React.ReactNode
  className?: string
  children: React.ReactNode
}

export function ChartCard<TData>({
  title,
  hint,
  query,
  isEmpty = false,
  emptyMessage = 'No data in this window yet.',
  actions,
  className,
  children,
}: ChartCardProps<TData>) {
  const { isPending, isFetching, isError, error, dataUpdatedAt, refetch } = query
  useTick(TICK_MS)

  return (
    <Card className={cn('flex flex-col', className)}>
      <CardHeader>
        <div className="min-w-0">
          <h2 className="truncate text-sm font-medium text-ink">{title}</h2>
          {hint ? <p className="mt-0.5 truncate text-xs text-muted">{hint}</p> : null}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {actions}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => void refetch()}
            disabled={isFetching}
            aria-label={`Refresh ${title}`}
            title={`Refresh ${title}`}
          >
            <RefreshCw className={isFetching ? 'animate-spin' : undefined} aria-hidden />
          </Button>
        </div>
      </CardHeader>

      <CardBody className="flex-1">
        {isPending ? (
          <div className="h-full min-h-32 animate-pulse rounded-control bg-raised" />
        ) : isError ? (
          <div className="space-y-3 py-2">
            <p className="text-sm text-alert">{error.message}</p>
            <Button variant="outline" size="sm" onClick={() => void refetch()}>
              Try again
            </Button>
          </div>
        ) : isEmpty ? (
          <p className="py-6 text-center text-sm text-muted">{emptyMessage}</p>
        ) : (
          children
        )}
      </CardBody>

      {/* Provenance, not decoration: a dashboard that polls needs to say how old
          the number on screen is, or a stale figure is indistinguishable from a
          fresh one. */}
      <div className="border-t border-rule px-5 py-2">
        <p className="text-xs text-muted">
          {dataUpdatedAt ? `Updated ${formatRelative(new Date(dataUpdatedAt))}` : 'Loading…'}
        </p>
      </div>
    </Card>
  )
}
