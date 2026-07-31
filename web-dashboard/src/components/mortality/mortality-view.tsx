'use client'

import type { ColumnDef } from '@tanstack/react-table'
import { useMemo } from 'react'

import { MortalityForm } from '@/components/mortality/mortality-form'
import { HogTagCell, RecordsView, useRecordsView } from '@/components/records/records-view'
import { usePermissions } from '@/hooks/use-current-user'
import { useDashboardFilters } from '@/hooks/use-dashboard-filters'
import { useMortalityEvents } from '@/hooks/use-mortality'
import type { MortalityEvent } from '@/lib/api/types'
import { NO_VALUE, formatBusinessDate } from '@/lib/format'

const LIMIT = 200

export function MortalityView() {
  const { filters } = useDashboardFilters()
  const { isFormOpen, setFormOpen, tags } = useRecordsView()
  // Recording a death is manager-only (`ManagerUser` on the route), unlike feed
  // and health records which any non-viewer may write.
  const { canManage } = usePermissions()
  const query = useMortalityEvents({ dateFrom: filters.dateFrom, dateTo: filters.dateTo })

  const columns = useMemo<ColumnDef<MortalityEvent, never>[]>(
    () => [
      {
        id: 'event_date',
        accessorKey: 'event_date',
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
        accessorFn: (row) => tags.get(row.hog_id) ?? String(row.hog_id),
        header: 'Hog',
        cell: (info) => <HogTagCell hogId={info.row.original.hog_id} tags={tags} />,
      },
      { id: 'cause', accessorKey: 'cause', header: 'Cause' },
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
      eyebrow="Herd"
      title="Mortality"
      addLabel="Record death"
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
      initialSortId="event_date"
      // A genuinely empty table on the demo farm, and correct: the bulk seeder
      // drew two deaths across five farms and none on this one.
      emptyMessage="No deaths recorded in this window."
    >
      <MortalityForm open={isFormOpen} onClose={() => setFormOpen(false)} />
    </RecordsView>
  )
}
