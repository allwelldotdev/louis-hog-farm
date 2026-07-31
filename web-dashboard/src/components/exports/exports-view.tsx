'use client'

import { Download } from 'lucide-react'

import { DateRangeFilter } from '@/components/date-range-filter'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { useDashboardFilters } from '@/hooks/use-dashboard-filters'

/**
 * CSV downloads.
 *
 * Each row is a plain `<a download>` at the passthrough route, not a `fetch`.
 * The backend answers with a `StreamingResponse` and the proxy forwards
 * `content-disposition` and pipes the body through, so the browser writes the
 * file to disk as it arrives. Fetching into a blob and calling
 * `URL.createObjectURL` — the usual reflex — would buffer the whole export in
 * memory and undo the one thing the streaming was for.
 */

type Export = {
  key: string
  label: string
  description: string
  /** Whether `date_from` / `date_to` narrow this export at all. */
  dated: boolean
}

const EXPORTS: Export[] = [
  {
    key: 'hogs',
    label: 'Hogs',
    description: 'The full roster: tag, breed, sex, class, lineage and status.',
    dated: false,
  },
  {
    key: 'health_records',
    label: 'Health records',
    description: 'Every weigh-in, with temperature and notes.',
    dated: true,
  },
  {
    key: 'feed_records',
    label: 'Feed records',
    description: 'Amount and cost per animal per day.',
    dated: true,
  },
  {
    key: 'breeding_cycles',
    label: 'Breeding cycles',
    description: 'Service and farrowing dates with outcomes.',
    dated: true,
  },
  {
    key: 'alerts',
    label: 'Alerts',
    description: 'Everything the rule engine raised, with its status.',
    dated: true,
  },
  {
    key: 'alert_rules',
    label: 'Alert rules',
    description: 'The rule definitions themselves.',
    dated: false,
  },
  {
    key: 'users',
    label: 'Users',
    description: 'Staff on this farm and their roles.',
    dated: false,
  },
]

function exportHref(key: string, dated: boolean, dateFrom?: string, dateTo?: string): string {
  const params = new URLSearchParams()
  if (dated && dateFrom) params.set('date_from', dateFrom)
  if (dated && dateTo) params.set('date_to', dateTo)
  const query = params.toString()
  return `/api/backend/exports/${key}${query ? `?${query}` : ''}`
}

export function ExportsView() {
  const { filters } = useDashboardFilters()

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <p className="eyebrow">Data</p>
        <h1 className="text-xl font-semibold tracking-tight text-ink">Exports</h1>
        <p className="text-sm text-muted">
          Comma-separated values, streamed straight from the database.
        </p>
      </div>

      <Card>
        <CardBody className="flex flex-wrap items-end gap-4">
          <DateRangeFilter idPrefix="export" />
          <p className="pb-2.5 text-xs text-muted">
            Applies to the dated exports below. The others always cover everything.
          </p>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-sm font-medium text-ink">Available exports</h2>
          <p className="text-xs text-muted">{EXPORTS.length} of 9 record types</p>
        </CardHeader>

        <ul>
          {EXPORTS.map((item) => (
            <li
              key={item.key}
              className="flex flex-wrap items-center justify-between gap-4 border-b border-rule/60 px-5 py-3.5 last:border-0"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-ink">
                  {item.label}
                  {item.dated ? null : (
                    <span className="ml-2 text-xs font-normal text-muted">all time</span>
                  )}
                </p>
                <p className="mt-0.5 text-xs text-muted">{item.description}</p>
              </div>

              <a
                href={exportHref(item.key, item.dated, filters.dateFrom, filters.dateTo)}
                download={`${item.key}.csv`}
                className="inline-flex h-8 items-center gap-2 rounded-control border border-rule px-3 text-sm text-ink transition-colors hover:border-rule-strong hover:bg-raised"
              >
                <Download aria-hidden className="size-4" />
                Download
              </a>
            </li>
          ))}
        </ul>
      </Card>

      {/* Stated rather than quietly omitted. Offering seven downloads on a page
          that looks complete is how a reader concludes the other two do not
          exist as data. */}
      <Card>
        <CardBody className="space-y-1">
          <p className="text-sm text-ink">Vaccinations and mortality have no export</p>
          <p className="text-xs text-muted">
            Both tables are recorded in the app and shown on their own pages, but the API exposes no
            CSV for either. Adding them is a backend change.
          </p>
        </CardBody>
      </Card>
    </div>
  )
}
