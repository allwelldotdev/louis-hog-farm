'use client'

import type { ColumnDef } from '@tanstack/react-table'
import { X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'

import { DataTable } from '@/components/data-table'
import { HogTagCell } from '@/components/records/records-view'
import { Button } from '@/components/ui/button'
import { Label, Select } from '@/components/ui/field'
import { useAlerts, useUpdateAlert } from '@/hooks/use-alerts'
import { usePermissions } from '@/hooks/use-current-user'
import { useDashboardFilters } from '@/hooks/use-dashboard-filters'
import { useHogTags } from '@/hooks/use-hogs'
import { ApiError } from '@/lib/api/client'
import type { Alert, AlertStatus, AlertType } from '@/lib/api/types'
import { NO_VALUE, formatBusinessDate, formatInteger, humanize } from '@/lib/format'
import { cn } from '@/lib/utils'

/**
 * The list behind the dashboard's alert panel.
 *
 * Alerts are the alert engine's own output — `app/services/alert_rules.py`
 * produces them, including the seeded ones — so this page is where that engine
 * becomes visible as something a farm acts on rather than a number on a tile.
 */

const STATUSES: AlertStatus[] = ['open', 'acknowledged', 'resolved']
const TYPES: AlertType[] = ['growth_anomaly', 'vaccination_due', 'breeding_event', 'data_gap']

const STATUS_TONE: Record<AlertStatus, string> = {
  open: 'bg-alert/15 text-alert',
  acknowledged: 'bg-ochre/15 text-ochre',
  resolved: 'bg-gain/15 text-gain',
}

const LIMIT = 200

/**
 * The row's own actions, owning their own mutation.
 *
 * Lifting the mutation into `AlertsView` would put a value that changes
 * identity on every request into the column definitions' dependency list, so
 * every column would be rebuilt mid-flight. A component per row keeps the
 * pending state where it belongs: on the button that was clicked.
 */
function AlertActions({ alert }: { alert: Alert }) {
  const update = useUpdateAlert()
  if (alert.status === 'resolved') return null

  const act = async (status: AlertStatus) => {
    try {
      await update.mutateAsync({ id: alert.id, status })
      toast.success(status === 'resolved' ? 'Alert resolved' : 'Alert acknowledged')
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Could not update the alert.')
    }
  }

  return (
    <div className="flex justify-end gap-2">
      {alert.status === 'open' ? (
        <Button
          variant="ghost"
          size="sm"
          disabled={update.isPending}
          onClick={() => void act('acknowledged')}
        >
          Acknowledge
        </Button>
      ) : null}
      <Button
        variant="outline"
        size="sm"
        disabled={update.isPending}
        onClick={() => void act('resolved')}
      >
        Resolve
      </Button>
    </div>
  )
}

export function AlertsView() {
  const { filters, setFilters } = useDashboardFilters()
  const [alertType, setAlertType] = useState<string>('')
  const tags = useHogTags()
  const { canManage } = usePermissions()
  const query = useAlerts({ status: filters.status, alertType })

  const columns = useMemo<ColumnDef<Alert, never>[]>(
    () => [
      {
        id: 'alert_date',
        accessorKey: 'alert_date',
        header: 'Raised',
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
      {
        id: 'alert_type',
        accessorKey: 'alert_type',
        header: 'Type',
        cell: (info) => <span className="text-muted">{humanize(info.getValue())}</span>,
      },
      {
        id: 'status',
        accessorKey: 'status',
        header: 'Status',
        cell: (info) => {
          const value = info.getValue() as AlertStatus
          return (
            <span
              className={cn(
                'inline-block rounded-sm px-1.5 py-0.5 text-[0.6875rem] font-medium',
                STATUS_TONE[value],
              )}
            >
              {humanize(value)}
            </span>
          )
        },
      },
      {
        id: 'message',
        accessorKey: 'message',
        header: 'Message',
        enableSorting: false,
        // The one column allowed to wrap: a rule's message is a sentence, and
        // truncating it removes the only thing that says what to do.
        cell: (info) => (
          <span className="block max-w-lg text-wrap text-muted">{info.getValue()}</span>
        ),
      },
      {
        id: 'resolution_notes',
        accessorKey: 'resolution_notes',
        header: 'Resolution',
        enableSorting: false,
        cell: (info) => <span className="text-muted">{info.getValue() ?? NO_VALUE}</span>,
      },
      {
        id: 'actions',
        header: '',
        enableSorting: false,
        enableHiding: false,
        cell: (info) => (canManage ? <AlertActions alert={info.row.original} /> : null),
      },
    ],
    [tags, canManage],
  )

  const rows = query.data?.items ?? []
  const openCount = rows.filter((alert) => alert.status === 'open').length

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <p className="eyebrow">Attention</p>
        <h1 className="text-xl font-semibold tracking-tight text-ink">Alerts</h1>
        {!query.isPending ? (
          <p className="text-sm text-muted">
            <span className="figure text-ink">{formatInteger(openCount)}</span> open of{' '}
            <span className="figure text-ink">{formatInteger(query.data?.total)}</span>
          </p>
        ) : null}
      </div>

      {query.isError ? (
        <div className="space-y-3 rounded-card border border-rule bg-surface px-5 py-6">
          <p className="text-sm text-alert">{query.error.message}</p>
          <Button variant="outline" size="sm" onClick={() => void query.refetch()}>
            Try again
          </Button>
        </div>
      ) : query.isPending ? (
        <div className="h-96 animate-pulse rounded-card bg-surface" />
      ) : (
        <>
          <DataTable
            columns={columns}
            data={rows}
            getRowId={(alert) => String(alert.id)}
            initialSort={[{ id: 'alert_date', desc: true }]}
            emptyMessage="Nothing needs attention."
            toolbar={
              <>
                <div className="space-y-2">
                  <Label htmlFor="alert-status">Status</Label>
                  <Select
                    id="alert-status"
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
                  <Label htmlFor="alert-type">Type</Label>
                  <Select
                    id="alert-type"
                    value={alertType}
                    onChange={(event) => setAlertType(event.target.value)}
                  >
                    <option value="">All types</option>
                    {TYPES.map((value) => (
                      <option key={value} value={value}>
                        {humanize(value)}
                      </option>
                    ))}
                  </Select>
                </div>

                {filters.status || alertType ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mb-0.5"
                    onClick={() => {
                      setFilters({ status: '' })
                      setAlertType('')
                    }}
                  >
                    <X aria-hidden />
                    Clear
                  </Button>
                ) : null}
              </>
            }
          />

          {query.data.total > rows.length ? (
            <p className="text-xs text-alert">
              Showing the most recent {formatInteger(LIMIT)} of {formatInteger(query.data.total)}.
              Narrow the filters to see the rest.
            </p>
          ) : null}
        </>
      )}
    </div>
  )
}
