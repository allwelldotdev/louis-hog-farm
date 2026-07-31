'use client'

import type { ColumnDef } from '@tanstack/react-table'
import { useMemo } from 'react'

import { HealthRecordForm } from '@/components/records/health-record-form'
import { HogTagCell, RecordsView, useRecordsView } from '@/components/records/records-view'
import { useDashboardFilters } from '@/hooks/use-dashboard-filters'
import { useHealthRecords } from '@/hooks/use-records'
import type { HealthRecord } from '@/lib/api/types'
import { NO_VALUE, formatBusinessDate, formatNumber } from '@/lib/format'

const LIMIT = 200

export function HealthRecordsView() {
  const { filters } = useDashboardFilters()
  const { isFormOpen, setFormOpen, tags, canWrite } = useRecordsView()
  const query = useHealthRecords({
    dateFrom: filters.dateFrom,
    dateTo: filters.dateTo,
    limit: LIMIT,
  })

  const columns = useMemo<ColumnDef<HealthRecord, never>[]>(
    () => [
      {
        id: 'record_date',
        accessorKey: 'record_date',
        header: 'Date',
        enableHiding: false,
        cell: (info) => (
          <span className="text-ink">
            {formatBusinessDate(info.getValue(), {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            })}
          </span>
        ),
      },
      {
        id: 'hog',
        accessorFn: (record) => tags.get(record.hog_id) ?? String(record.hog_id),
        header: 'Hog',
        cell: (info) => <HogTagCell hogId={info.row.original.hog_id} tags={tags} />,
      },
      {
        id: 'weight',
        accessorFn: (record) => Number(record.weight),
        header: 'Weight',
        cell: (info) => (
          <span className="figure text-ink">{formatNumber(info.getValue(), 1)} kg</span>
        ),
      },
      {
        id: 'temperature',
        accessorFn: (record) => (record.temperature === null ? null : Number(record.temperature)),
        header: 'Temperature',
        cell: (info) => {
          const value = info.getValue() as number | null
          return (
            <span className="figure text-ink">
              {value === null ? NO_VALUE : `${formatNumber(value, 1)} °C`}
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
    ],
    [tags],
  )

  return (
    <RecordsView
      eyebrow="Records"
      title="Health"
      addLabel="Record weigh-in"
      canWrite={canWrite}
      onAdd={() => setFormOpen(true)}
      columns={columns}
      rows={query.data?.items ?? []}
      total={query.data?.total}
      limit={LIMIT}
      isPending={query.isPending}
      error={query.error}
      onRetry={() => void query.refetch()}
      getRowId={(record) => String(record.id)}
      emptyMessage="No health records in this window."
    >
      {/* Not merely hidden for a viewer: an unreachable `<dialog>` in the DOM
          still mounts its fields and its hog picker. */}
      {canWrite ? <HealthRecordForm open={isFormOpen} onClose={() => setFormOpen(false)} /> : null}
    </RecordsView>
  )
}
