'use client'

import type { ColumnDef } from '@tanstack/react-table'
import { useMemo } from 'react'

import { FeedRecordForm } from '@/components/records/feed-record-form'
import { HogTagCell, RecordsView, useRecordsView } from '@/components/records/records-view'
import { useDashboardFilters } from '@/hooks/use-dashboard-filters'
import { useFarm } from '@/hooks/use-farm'
import { useFeedRecords } from '@/hooks/use-records'
import type { FeedRecord } from '@/lib/api/types'
import { formatBusinessDate, formatMoney, formatNumber } from '@/lib/format'

const LIMIT = 200

export function FeedRecordsView() {
  const { filters } = useDashboardFilters()
  const { isFormOpen, setFormOpen, tags, canWrite } = useRecordsView()
  const farm = useFarm()
  const currency = farm.data?.currency_code ?? 'NGN'

  const query = useFeedRecords({
    dateFrom: filters.dateFrom,
    dateTo: filters.dateTo,
    limit: LIMIT,
  })

  const columns = useMemo<ColumnDef<FeedRecord, never>[]>(
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
        id: 'feed_amount',
        accessorFn: (record) => Number(record.feed_amount),
        header: 'Amount',
        cell: (info) => (
          <span className="figure text-ink">{formatNumber(info.getValue(), 2)} kg</span>
        ),
      },
      {
        id: 'feed_cost',
        accessorFn: (record) => Number(record.feed_cost),
        header: 'Cost',
        // The row's own `currency_code` rather than the farm's: a record written
        // before the farm's currency was set is still true in the currency it
        // was written in.
        cell: (info) => (
          <span className="figure text-ink">
            {formatMoney(info.getValue(), info.row.original.currency_code)}
          </span>
        ),
      },
    ],
    [tags],
  )

  return (
    <RecordsView
      eyebrow="Records"
      title="Feed"
      addLabel="Record feed"
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
      emptyMessage={`No feed records in this window. Costs are in ${currency}.`}
    >
      {canWrite ? <FeedRecordForm open={isFormOpen} onClose={() => setFormOpen(false)} /> : null}
    </RecordsView>
  )
}
