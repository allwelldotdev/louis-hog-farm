'use client'

import type { ColumnDef } from '@tanstack/react-table'
import { X } from 'lucide-react'
import Link from 'next/link'
import { useMemo } from 'react'

import { DataTable } from '@/components/data-table'
import { StatusBadge } from '@/components/hogs/hog-badges'
import { Button } from '@/components/ui/button'
import { Label, Select } from '@/components/ui/field'
import { useBreedDistribution } from '@/hooks/use-dashboard'
import { useDashboardFilters } from '@/hooks/use-dashboard-filters'
import { HOGS_PAGE_LIMIT, useHogs } from '@/hooks/use-hogs'
import type { Hog, HogStatus, ProductionClass } from '@/lib/api/types'
import { formatBusinessDate, formatInteger, humanize, parseBusinessDate } from '@/lib/format'

const STATUSES: HogStatus[] = ['active', 'archived', 'deceased']
const PRODUCTION_CLASSES: ProductionClass[] = [
  'piglet',
  'weaner',
  'grower',
  'finisher',
  'gilt',
  'sow',
  'boar',
]

/** Whole days since birth. Sorting by this is sorting by `birth_date`
 *  descending, but a reader wants "18 weeks", not a date to subtract. */
function ageDays(birthDate: string, today: Date): number {
  return Math.max(
    0,
    Math.round((today.getTime() - parseBusinessDate(birthDate).getTime()) / 86_400_000),
  )
}

/**
 * Weeks up to a year, months beyond it — the way a pig unit actually talks
 * about its animals. Market pigs are "22 weeks"; a sow is "two and a half
 * years". Mixing the two mid-column ("16 wk" beside "4.5 mo") reads as a bug
 * even when both figures are right.
 */
function formatAge(days: number): string {
  if (days < 14) return `${formatInteger(days)} d`
  if (days < 365) return `${formatInteger(Math.round(days / 7))} wk`
  return `${formatInteger(Math.round(days / 30.44))} mo`
}

export function HogsTable() {
  const { filters, setFilters, isFiltered } = useDashboardFilters()
  const { data: breeds } = useBreedDistribution()
  const query = useHogs()

  const rows = useMemo(() => query.data?.items ?? [], [query.data])

  // The whole roster is already in memory, so a parent id can be shown as the
  // tag people actually use. A parent outside the current filter falls back to
  // its id rather than disappearing.
  const tagById = useMemo(() => new Map(rows.map((hog) => [hog.id, hog.tag_number])), [rows])

  const columns = useMemo<ColumnDef<Hog, never>[]>(() => {
    const today = new Date()
    const parentTag = (id: number | null) =>
      id === null ? '—' : (tagById.get(id) ?? `#${formatInteger(id)}`)

    return [
      {
        id: 'tag_number',
        accessorKey: 'tag_number',
        header: 'Tag',
        enableHiding: false,
        cell: (info) => (
          <Link
            href={`/hogs/${info.row.original.id}`}
            className="figure text-ink transition-colors hover:text-ochre"
          >
            {info.getValue()}
          </Link>
        ),
      },
      { id: 'breed', accessorKey: 'breed', header: 'Breed' },
      {
        id: 'sex',
        accessorKey: 'sex',
        header: 'Sex',
        cell: (info) => humanize(info.getValue()),
      },
      {
        id: 'production_class',
        accessorKey: 'production_class',
        header: 'Class',
        cell: (info) => humanize(info.getValue()),
      },
      {
        id: 'age',
        accessorFn: (hog) => ageDays(hog.birth_date, today),
        header: 'Age',
        cell: (info) => <span className="figure text-ink">{formatAge(info.getValue())}</span>,
      },
      {
        id: 'birth_date',
        accessorKey: 'birth_date',
        header: 'Born',
        cell: (info) => (
          <span className="text-muted">
            {formatBusinessDate(info.getValue(), {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            })}
          </span>
        ),
      },
      {
        id: 'status',
        accessorKey: 'status',
        header: 'Status',
        cell: (info) => <StatusBadge status={info.getValue()} />,
      },
      {
        id: 'dam',
        accessorFn: (hog) => hog.dam_id,
        header: 'Dam',
        enableSorting: false,
        cell: (info) => <span className="text-muted">{parentTag(info.row.original.dam_id)}</span>,
      },
      {
        id: 'sire',
        accessorFn: (hog) => hog.sire_id,
        header: 'Sire',
        enableSorting: false,
        cell: (info) => <span className="text-muted">{parentTag(info.row.original.sire_id)}</span>,
      },
    ]
  }, [tagById])

  if (query.isError) {
    return (
      <div className="space-y-3 rounded-card border border-rule bg-surface px-5 py-6">
        <p className="text-sm text-alert">{query.error.message}</p>
        <Button variant="outline" size="sm" onClick={() => void query.refetch()}>
          Try again
        </Button>
      </div>
    )
  }

  if (query.isPending) {
    return <div className="h-96 animate-pulse rounded-card bg-surface" />
  }

  const total = query.data.total
  const truncated = total > rows.length

  return (
    <div className="space-y-4">
      <DataTable
        columns={columns}
        data={rows}
        getRowId={(hog) => String(hog.id)}
        initialSort={[{ id: 'tag_number', desc: false }]}
        // Lineage is off by default: it is recorded only for animals born on
        // the farm, so for most rosters these are two columns of em-dashes.
        // Still one click away in the Columns menu when it matters.
        initialVisibility={{ dam: false, sire: false }}
        emptyMessage={
          isFiltered ? 'No animal matches these filters.' : 'No hogs recorded on this farm yet.'
        }
        toolbar={
          <>
            <div className="space-y-2">
              <Label htmlFor="hog-status">Status</Label>
              <Select
                id="hog-status"
                value={filters.status ?? ''}
                onChange={(event) => setFilters({ status: event.target.value })}
              >
                <option value="">All statuses</option>
                {STATUSES.map((value) => (
                  <option key={value} value={value}>
                    {humanize(value)}
                  </option>
                ))}
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="hog-breed">Breed</Label>
              <Select
                id="hog-breed"
                value={filters.breed ?? ''}
                onChange={(event) => setFilters({ breed: event.target.value })}
              >
                <option value="">All breeds</option>
                {breeds?.rows.map((row) => (
                  <option key={row.key} value={row.key}>
                    {row.key}
                  </option>
                ))}
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="hog-class">Class</Label>
              <Select
                id="hog-class"
                value={filters.productionClass ?? ''}
                onChange={(event) => setFilters({ productionClass: event.target.value })}
              >
                <option value="">All classes</option>
                {PRODUCTION_CLASSES.map((value) => (
                  <option key={value} value={value}>
                    {humanize(value)}
                  </option>
                ))}
              </Select>
            </div>

            {isFiltered ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setFilters({ status: '', breed: '', productionClass: '' })}
              >
                <X aria-hidden />
                Clear
              </Button>
            ) : null}
          </>
        }
      />

      {/* The list endpoint caps at 200 rows. Saying so beats a table that
          quietly stops short of the herd it claims to show. */}
      {truncated ? (
        <p className="text-xs text-alert">
          Showing the first {formatInteger(HOGS_PAGE_LIMIT)} of {formatInteger(total)} animals.
          Narrow the filters to see the rest.
        </p>
      ) : null}
    </div>
  )
}
