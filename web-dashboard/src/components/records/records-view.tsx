'use client'

import type { ColumnDef } from '@tanstack/react-table'
import { Plus } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'

import { DataTable } from '@/components/data-table'
import { DateRangeFilter } from '@/components/date-range-filter'
import { Button } from '@/components/ui/button'
import { usePermissions } from '@/hooks/use-current-user'
import { useHogTags } from '@/hooks/use-hogs'
import { formatInteger } from '@/lib/format'

/**
 * The frame the feed and health record pages share.
 *
 * They are the same page with different columns: a date window in the URL, a
 * table of records newest first, and one create form behind a role-gated
 * button. Only the columns and the form differ, so those are what gets passed
 * in — everything else would otherwise be written twice and drift once.
 */

/** Records name their animal by id; people know them by ear tag. Rendered as a
 *  link, because "which animal is this" is immediately followed by "show me
 *  that animal". */
export function HogTagCell({ hogId, tags }: { hogId: number; tags: Map<number, string> }) {
  return (
    <Link href={`/hogs/${hogId}`} className="figure text-ink transition-colors hover:text-ochre">
      {tags.get(hogId) ?? `#${formatInteger(hogId)}`}
    </Link>
  )
}

export function useRecordsView() {
  const [isFormOpen, setFormOpen] = useState(false)
  const tags = useHogTags()
  const { canWrite } = usePermissions()

  return { isFormOpen, setFormOpen, tags, canWrite }
}

type RecordsViewProps<TRecord> = {
  eyebrow: string
  title: string
  /** What the create button says, and what a viewer is told instead. */
  addLabel: string
  canWrite: boolean
  onAdd: () => void
  columns: ColumnDef<TRecord, never>[]
  rows: TRecord[]
  total: number | undefined
  limit: number
  isPending: boolean
  error: Error | null
  onRetry: () => void
  getRowId: (row: TRecord) => string
  emptyMessage: string
  children: React.ReactNode
}

export function RecordsView<TRecord>({
  eyebrow,
  title,
  addLabel,
  canWrite,
  onAdd,
  columns,
  rows,
  total,
  limit,
  isPending,
  error,
  onRetry,
  getRowId,
  emptyMessage,
  children,
}: RecordsViewProps<TRecord>) {
  const truncated = total !== undefined && total > rows.length

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <p className="eyebrow">{eyebrow}</p>
          <h1 className="text-xl font-semibold tracking-tight text-ink">{title}</h1>
        </div>

        {/* Absent rather than disabled for a viewer: a greyed-out button still
            advertises an action they will never be able to take. */}
        {canWrite ? (
          <Button onClick={onAdd}>
            <Plus aria-hidden />
            {addLabel}
          </Button>
        ) : null}
      </div>

      {error ? (
        <div className="space-y-3 rounded-card border border-rule bg-surface px-5 py-6">
          <p className="text-sm text-alert">{error.message}</p>
          <Button variant="outline" size="sm" onClick={onRetry}>
            Try again
          </Button>
        </div>
      ) : isPending ? (
        <div className="h-96 animate-pulse rounded-card bg-surface" />
      ) : (
        <>
          <DataTable
            columns={columns}
            data={rows}
            getRowId={getRowId}
            initialSort={[{ id: 'record_date', desc: true }]}
            emptyMessage={emptyMessage}
            toolbar={<DateRangeFilter idPrefix={eyebrow.toLowerCase()} />}
          />

          {truncated ? (
            <p className="text-xs text-alert">
              Showing the most recent {formatInteger(limit)} of {formatInteger(total)}. Narrow the
              date range to see the rest.
            </p>
          ) : null}
        </>
      )}

      {children}
    </div>
  )
}
