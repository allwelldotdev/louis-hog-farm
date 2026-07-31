'use client'

import type { ColumnDef } from '@tanstack/react-table'
import { ArrowLeft, Plus } from 'lucide-react'
import Link from 'next/link'
import { useMemo, useState } from 'react'

import { DataTable } from '@/components/data-table'
import { StatusBadge } from '@/components/hogs/hog-badges'
import { HogGrowthChart } from '@/components/hogs/hog-growth-chart'
import { FeedRecordForm } from '@/components/records/feed-record-form'
import { HealthRecordForm } from '@/components/records/health-record-form'
import { Button } from '@/components/ui/button'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { usePermissions } from '@/hooks/use-current-user'
import { useFarm } from '@/hooks/use-farm'
import { useHog } from '@/hooks/use-hogs'
import { useFeedRecords, useHealthRecords } from '@/hooks/use-records'
import type { FeedRecord, HealthRecord } from '@/lib/api/types'
import {
  NO_VALUE,
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

function ParentLink({ id }: { id: number | null }) {
  if (id === null) return <span className="text-muted">Not recorded</span>
  return (
    <Link href={`/hogs/${id}`} className="text-ochre hover:underline">
      #{formatInteger(id)}
    </Link>
  )
}

export function HogDetail({ hogId }: { hogId: number }) {
  const farm = useFarm()
  const hog = useHog(hogId)
  const health = useHealthRecords({ hogId })
  const feed = useFeedRecords({ hogId })
  const { canWrite } = usePermissions()
  const [isHealthFormOpen, setHealthFormOpen] = useState(false)
  const [isFeedFormOpen, setFeedFormOpen] = useState(false)
  const currency = farm.data?.currency_code ?? 'NGN'

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
        </CardHeader>
        <CardBody>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3 lg:grid-cols-5">
            <Fact label="Born">
              {formatBusinessDate(animal.birth_date, { dateStyle: 'medium' })}
            </Fact>
            <Fact label="Breed">{animal.breed}</Fact>
            <Fact label="Class">{humanize(animal.production_class)}</Fact>
            <Fact label="Dam">
              <ParentLink id={animal.dam_id} />
            </Fact>
            <Fact label="Sire">
              <ParentLink id={animal.sire_id} />
            </Fact>
          </dl>
        </CardBody>
      </Card>

      <HogGrowthChart hogId={hogId} />

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

      {/* Both forms open with this animal already chosen — the point of coming
          here to record something is that you already know which animal. */}
      <HealthRecordForm
        open={isHealthFormOpen}
        onClose={() => setHealthFormOpen(false)}
        hogId={hogId}
      />
      <FeedRecordForm open={isFeedFormOpen} onClose={() => setFeedFormOpen(false)} hogId={hogId} />
    </div>
  )
}
