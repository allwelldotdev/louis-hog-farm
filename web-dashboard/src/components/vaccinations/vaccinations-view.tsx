'use client'

import type { ColumnDef } from '@tanstack/react-table'
import { useMemo } from 'react'

import { HogTagCell, RecordsView, useRecordsView } from '@/components/records/records-view'
import { VaccinationForm } from '@/components/vaccinations/vaccination-form'
import { useFarm } from '@/hooks/use-farm'
import { useVaccinations } from '@/hooks/use-vaccinations'
import type { Vaccination } from '@/lib/api/types'
import { NO_VALUE, farmToday, formatBusinessDate } from '@/lib/format'
import { cn } from '@/lib/utils'

const LIMIT = 200
const DATE_FORMAT: Intl.DateTimeFormatOptions = {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
}

export function VaccinationsView() {
  const { isFormOpen, setFormOpen, tags, canWrite } = useRecordsView()
  const farm = useFarm()
  const query = useVaccinations()
  const today = farmToday(farm.data?.timezone ?? 'UTC')

  const columns = useMemo<ColumnDef<Vaccination, never>[]>(
    () => [
      {
        id: 'dose_date',
        accessorKey: 'dose_date',
        header: 'Dose date',
        enableHiding: false,
        cell: (info) => (
          <span className="text-ink">{formatBusinessDate(info.getValue(), DATE_FORMAT)}</span>
        ),
      },
      {
        id: 'hog',
        accessorFn: (row) => tags.get(row.hog_id) ?? String(row.hog_id),
        header: 'Hog',
        cell: (info) => <HogTagCell hogId={info.row.original.hog_id} tags={tags} />,
      },
      { id: 'vaccine_name', accessorKey: 'vaccine_name', header: 'Vaccine' },
      {
        id: 'next_due_date',
        accessorKey: 'next_due_date',
        header: 'Next due',
        cell: (info) => {
          const value = info.getValue() as string | null
          if (value === null) return <span className="text-muted">{NO_VALUE}</span>
          // Overdue is the whole reason this column exists — the alert engine
          // fires on it, and the page should agree with the alert.
          const overdue = value < today
          return (
            <span className={cn(overdue ? 'text-alert' : 'text-muted')}>
              {formatBusinessDate(value, DATE_FORMAT)}
              {overdue ? ' · overdue' : ''}
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
    [tags, today],
  )

  return (
    <RecordsView
      eyebrow="Health"
      title="Vaccinations"
      addLabel="Record vaccination"
      canWrite={canWrite}
      onAdd={() => setFormOpen(true)}
      columns={columns}
      rows={query.data?.items ?? []}
      total={query.data?.total}
      limit={LIMIT}
      isPending={query.isPending}
      error={query.error}
      onRetry={() => void query.refetch()}
      getRowId={(row) => String(row.id)}
      emptyMessage="No vaccinations recorded on this farm."
      initialSortId="dose_date"
      // `GET /vaccinations` takes only `hog_id` — no date range to honour.
      showDateFilter={false}
    >
      <VaccinationForm open={isFormOpen} onClose={() => setFormOpen(false)} />
    </RecordsView>
  )
}
