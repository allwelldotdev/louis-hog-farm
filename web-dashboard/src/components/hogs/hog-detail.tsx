'use client'

import type { ColumnDef } from '@tanstack/react-table'
import { ArrowLeft, Pencil, Plus } from 'lucide-react'
import Link from 'next/link'
import { useMemo, useState } from 'react'

import { DataTable } from '@/components/data-table'
import { StatusBadge } from '@/components/hogs/hog-badges'
import { HogForm } from '@/components/hogs/hog-form'
import { HogGrowthChart } from '@/components/hogs/hog-growth-chart'
import { FeedRecordForm } from '@/components/records/feed-record-form'
import { HealthRecordForm } from '@/components/records/health-record-form'
import { Button } from '@/components/ui/button'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { VaccinationForm } from '@/components/vaccinations/vaccination-form'
import { usePermissions } from '@/hooks/use-current-user'
import { useFarm } from '@/hooks/use-farm'
import { useHog, useHogTags } from '@/hooks/use-hogs'
import { useFeedRecords, useHealthRecords } from '@/hooks/use-records'
import { useVaccinations } from '@/hooks/use-vaccinations'
import type { FeedRecord, HealthRecord, Vaccination } from '@/lib/api/types'
import {
  NO_VALUE,
  farmToday,
  formatBusinessDate,
  formatInteger,
  formatMoney,
  formatNumber,
  humanize,
} from '@/lib/format'

/** Decimal fields arrive as strings so no precision is lost in JSON. Parsing at
 *  the display boundary keeps that true everywhere else. */
function decimal(value: string | null): number | null {
  return value === null ? null : Number(value)
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="eyebrow">{label}</dt>
      <dd className="mt-1 text-sm text-ink">{children}</dd>
    </div>
  )
}

/**
 * A parent, named the way the farm names it.
 *
 * The roster is already in memory for the record tables, so the id resolves to
 * an ear tag; a parent missing from it falls back to its id rather than
 * vanishing. "Not recorded" is the honest answer for a genuine null — and it is
 * now a state the Edit form can change.
 */
function ParentLink({ id, tags }: { id: number | null; tags: Map<number, string> }) {
  if (id === null) return <span className="text-muted">Not recorded</span>
  return (
    <Link href={`/hogs/${id}`} className="text-ochre hover:underline">
      {tags.get(id) ?? `#${formatInteger(id)}`}
    </Link>
  )
}

export function HogDetail({ hogId }: { hogId: number }) {
  const farm = useFarm()
  const hog = useHog(hogId)
  const health = useHealthRecords({ hogId })
  const feed = useFeedRecords({ hogId })
  const vaccinations = useVaccinations(hogId)
  const tags = useHogTags()
  const { canWrite } = usePermissions()
  const [isHealthFormOpen, setHealthFormOpen] = useState(false)
  const [isFeedFormOpen, setFeedFormOpen] = useState(false)
  const [isVaccinationFormOpen, setVaccinationFormOpen] = useState(false)
  const [isEditOpen, setEditOpen] = useState(false)
  const currency = farm.data?.currency_code ?? 'NGN'
  const today = farmToday(farm.data?.timezone ?? 'UTC')

  const healthColumns = useMemo<ColumnDef<HealthRecord, never>[]>(
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
        id: 'weight',
        accessorFn: (record) => decimal(record.weight),
        header: 'Weight',
        cell: (info) => (
          <span className="figure text-ink">{formatNumber(info.getValue(), 1)} kg</span>
        ),
      },
      {
        id: 'temperature',
        accessorFn: (record) => decimal(record.temperature),
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
    [],
  )

  const feedColumns = useMemo<ColumnDef<FeedRecord, never>[]>(
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
        id: 'feed_amount',
        accessorFn: (record) => decimal(record.feed_amount),
        header: 'Amount',
        cell: (info) => (
          <span className="figure text-ink">{formatNumber(info.getValue(), 2)} kg</span>
        ),
      },
      {
        id: 'feed_cost',
        accessorFn: (record) => decimal(record.feed_cost),
        header: 'Cost',
        cell: (info) => (
          <span className="figure text-ink">{formatMoney(info.getValue(), currency)}</span>
        ),
      },
    ],
    [currency],
  )

  const vaccinationColumns = useMemo<ColumnDef<Vaccination, never>[]>(
    () => [
      {
        id: 'dose_date',
        accessorKey: 'dose_date',
        header: 'Given',
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
        id: 'vaccine_name',
        accessorKey: 'vaccine_name',
        header: 'Vaccine',
        cell: (info) => <span className="text-ink">{info.getValue()}</span>,
      },
      {
        id: 'next_due_date',
        accessorKey: 'next_due_date',
        header: 'Next due',
        cell: (info) => {
          const value = info.getValue() as string | null
          if (value === null) return <span className="text-muted">{NO_VALUE}</span>
          // The same overdue test the vaccinations page and the alert engine
          // use, so all three agree about which dose is late.
          const overdue = value < today
          return (
            <span className={overdue ? 'text-alert' : 'text-muted'}>
              {formatBusinessDate(value, { day: 'numeric', month: 'short', year: 'numeric' })}
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
    [today],
  )

  if (hog.isPending) {
    return <div className="h-96 animate-pulse rounded-card bg-surface" />
  }

  if (hog.isError) {
    return (
      <Card>
        <CardBody className="space-y-3">
          {/* Reading another farm's animal answers 404, not 403, so "not found"
              is the honest message for both cases. */}
          <p className="text-sm text-alert">{hog.error.message}</p>
          <Button variant="outline" size="sm" onClick={() => void hog.refetch()}>
            Try again
          </Button>
        </CardBody>
      </Card>
    )
  }

  const animal = hog.data

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Link
          href="/hogs"
          className="inline-flex items-center gap-1.5 text-xs text-muted transition-colors hover:text-ink"
        >
          <ArrowLeft aria-hidden className="size-3.5" />
          All hogs
        </Link>

        <div className="flex flex-wrap items-center gap-3">
          <h1 className="figure text-xl tracking-tight text-ink">{animal.tag_number}</h1>
          <StatusBadge status={animal.status} />
          <p className="text-sm text-muted">
            {animal.breed} · {humanize(animal.production_class)} · {humanize(animal.sex)}
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <h2 className="text-sm font-medium text-ink">Record</h2>
          {canWrite ? (
            <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
              <Pencil aria-hidden />
              Edit
            </Button>
          ) : null}
        </CardHeader>
        <CardBody>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3 lg:grid-cols-5">
            <Fact label="Born">
              {formatBusinessDate(animal.birth_date, { dateStyle: 'medium' })}
            </Fact>
            <Fact label="Breed">{animal.breed}</Fact>
            <Fact label="Class">{humanize(animal.production_class)}</Fact>
            <Fact label="Dam">
              <ParentLink id={animal.dam_id} tags={tags} />
            </Fact>
            <Fact label="Sire">
              <ParentLink id={animal.sire_id} tags={tags} />
            </Fact>
          </dl>
        </CardBody>
      </Card>

      <HogGrowthChart hogId={hogId} />

      <Card>
        <CardHeader>
          <h2 className="text-sm font-medium text-ink">Vaccinations</h2>
          <div className="flex items-center gap-3">
            <p className="text-xs text-muted">
              {formatInteger(vaccinations.data?.total)}{' '}
              {vaccinations.data?.total === 1 ? 'dose' : 'doses'}
            </p>
            {canWrite ? (
              <Button variant="outline" size="sm" onClick={() => setVaccinationFormOpen(true)}>
                <Plus aria-hidden />
                Add
              </Button>
            ) : null}
          </div>
        </CardHeader>
        <CardBody>
          {vaccinations.isPending ? (
            <div className="h-48 animate-pulse rounded-control bg-raised" />
          ) : (
            <DataTable
              columns={vaccinationColumns}
              data={vaccinations.data?.items ?? []}
              getRowId={(record) => String(record.id)}
              initialSort={[{ id: 'dose_date', desc: true }]}
              emptyMessage="No vaccinations recorded for this animal."
            />
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-sm font-medium text-ink">Weigh-ins</h2>
          <div className="flex items-center gap-3">
            <p className="text-xs text-muted">
              {formatInteger(health.data?.total)} health{' '}
              {health.data?.total === 1 ? 'record' : 'records'}
            </p>
            {canWrite ? (
              <Button variant="outline" size="sm" onClick={() => setHealthFormOpen(true)}>
                <Plus aria-hidden />
                Add
              </Button>
            ) : null}
          </div>
        </CardHeader>
        <CardBody>
          {health.isPending ? (
            <div className="h-48 animate-pulse rounded-control bg-raised" />
          ) : (
            <DataTable
              columns={healthColumns}
              data={health.data?.items ?? []}
              getRowId={(record) => String(record.id)}
              initialSort={[{ id: 'record_date', desc: true }]}
              emptyMessage="No health records for this animal."
            />
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-sm font-medium text-ink">Feed</h2>
          <div className="flex items-center gap-3">
            <p className="text-xs text-muted">
              {formatInteger(feed.data?.total)} feed {feed.data?.total === 1 ? 'record' : 'records'}
            </p>
            {canWrite ? (
              <Button variant="outline" size="sm" onClick={() => setFeedFormOpen(true)}>
                <Plus aria-hidden />
                Add
              </Button>
            ) : null}
          </div>
        </CardHeader>
        <CardBody>
          {feed.isPending ? (
            <div className="h-48 animate-pulse rounded-control bg-raised" />
          ) : (
            <DataTable
              columns={feedColumns}
              data={feed.data?.items ?? []}
              getRowId={(record) => String(record.id)}
              initialSort={[{ id: 'record_date', desc: true }]}
              emptyMessage="No feed records for this animal."
            />
          )}
        </CardBody>
      </Card>

      {/* Every form opens with this animal already chosen — the point of coming
          here to record something is that you already know which animal. */}
      {canWrite ? (
        <>
          <HealthRecordForm
            open={isHealthFormOpen}
            onClose={() => setHealthFormOpen(false)}
            hogId={hogId}
          />
          <FeedRecordForm
            open={isFeedFormOpen}
            onClose={() => setFeedFormOpen(false)}
            hogId={hogId}
          />
          <VaccinationForm
            open={isVaccinationFormOpen}
            onClose={() => setVaccinationFormOpen(false)}
            hogId={hogId}
          />
          <HogForm open={isEditOpen} onClose={() => setEditOpen(false)} hog={animal} />
        </>
      ) : null}
    </div>
  )
}
