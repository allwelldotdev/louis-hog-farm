'use client'

import type { ColumnDef } from '@tanstack/react-table'
import { useMemo, useState } from 'react'

import { CloseCycleForm, OpenCycleForm } from '@/components/breeding/breeding-forms'
import { HogTagCell, RecordsView, useRecordsView } from '@/components/records/records-view'
import { Button } from '@/components/ui/button'
import { useBreedingCycles } from '@/hooks/use-breeding'
import { usePermissions } from '@/hooks/use-current-user'
import type { BreedingCycle, BreedingStatus } from '@/lib/api/types'
import {
  NO_VALUE,
  formatBusinessDate,
  formatInteger,
  humanize,
  parseBusinessDate,
} from '@/lib/format'
import { cn } from '@/lib/utils'

const LIMIT = 200
const GESTATION_DAYS = 114
const DATE_FORMAT: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' }

const STATUS_TONE: Record<BreedingStatus, string> = {
  ongoing: 'bg-ochre/15 text-ochre',
  completed: 'bg-gain/15 text-gain',
  aborted: 'bg-alert/15 text-alert',
}

/** Farrowing is 114 days after service. The date is not stored — it is derived,
 *  and deriving it is what turns a list of start dates into something a farm can
 *  plan around. */
function dueDate(startDate: string): Date {
  const due = parseBusinessDate(startDate)
  due.setDate(due.getDate() + GESTATION_DAYS)
  return due
}

export function BreedingView() {
  const { isFormOpen, setFormOpen, tags } = useRecordsView()
  // Breeding cycles are manager-only on both POST and PATCH.
  const { canManage } = usePermissions()
  const [closing, setClosing] = useState<BreedingCycle | null>(null)
  const query = useBreedingCycles()

  const columns = useMemo<ColumnDef<BreedingCycle, never>[]>(
    () => [
      {
        id: 'start_date',
        accessorKey: 'start_date',
        header: 'Served',
        enableHiding: false,
        cell: (info) => (
          <span className="text-ink">{formatBusinessDate(info.getValue(), DATE_FORMAT)}</span>
        ),
      },
      {
        id: 'hog',
        accessorFn: (row) => tags.get(row.hog_id) ?? String(row.hog_id),
        header: 'Sow',
        cell: (info) => <HogTagCell hogId={info.row.original.hog_id} tags={tags} />,
      },
      {
        id: 'status',
        accessorKey: 'status',
        header: 'Status',
        cell: (info) => {
          const value = info.getValue() as BreedingStatus
          return (
            <span
              className={cn(
                'inline-block rounded-sm px-1.5 py-0.5 text-[0.6875rem] font-medium',
                STATUS_TONE[value],
              )}
            >
              {value === 'completed' ? 'Farrowed' : humanize(value)}
            </span>
          )
        },
      },
      {
        id: 'due',
        accessorFn: (row) => (row.status === 'ongoing' ? dueDate(row.start_date).getTime() : null),
        header: 'Due',
        cell: (info) => {
          const row = info.row.original
          if (row.status !== 'ongoing') return <span className="text-muted">{NO_VALUE}</span>
          const due = dueDate(row.start_date)
          const daysLeft = Math.round((due.getTime() - Date.now()) / 86_400_000)
          return (
            <span className={cn(daysLeft < 0 ? 'text-alert' : 'text-ink')}>
              {due.toLocaleDateString(undefined, DATE_FORMAT)}
              <span className="ml-1.5 text-xs text-muted">
                {daysLeft < 0
                  ? `${formatInteger(-daysLeft)} d over`
                  : `in ${formatInteger(daysLeft)} d`}
              </span>
            </span>
          )
        },
      },
      {
        id: 'end_date',
        accessorKey: 'end_date',
        header: 'Ended',
        cell: (info) => {
          const value = info.getValue() as string | null
          return (
            <span className="text-muted">
              {value === null ? NO_VALUE : formatBusinessDate(value, DATE_FORMAT)}
            </span>
          )
        },
      },
      {
        id: 'notes',
        accessorKey: 'notes',
        header: 'Notes',
        enableSorting: false,
        cell: (info) => <span className="text-muted">{info.getValue() ?? NO_VALUE}</span>,
      },
      {
        id: 'actions',
        header: '',
        enableSorting: false,
        enableHiding: false,
        // Only ongoing cycles can change: the API refuses every field but notes
        // once a cycle is closed, so an edit button on a closed row would be an
        // affordance for a 400.
        cell: (info) =>
          canManage && info.row.original.status === 'ongoing' ? (
            <Button variant="outline" size="sm" onClick={() => setClosing(info.row.original)}>
              Close
            </Button>
          ) : null,
      },
    ],
    [tags, canManage],
  )

  return (
    <RecordsView
      eyebrow="Herd"
      title="Breeding"
      addLabel="Open cycle"
      canWrite={canManage}
      onAdd={() => setFormOpen(true)}
      columns={columns}
      rows={query.data?.items ?? []}
      total={query.data?.total}
      limit={LIMIT}
      isPending={query.isPending}
      error={query.error}
      onRetry={() => void query.refetch()}
      getRowId={(row) => String(row.id)}
      initialSortId="start_date"
      emptyMessage="No breeding cycles recorded on this farm."
      // `GET /breeding-cycles` takes only `hog_id` — no date range to honour.
      showDateFilter={false}
    >
      <OpenCycleForm open={isFormOpen} onClose={() => setFormOpen(false)} />
      <CloseCycleForm cycle={closing} onClose={() => setClosing(null)} />
    </RecordsView>
  )
}
