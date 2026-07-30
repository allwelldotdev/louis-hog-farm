'use client'

import { ChartCard } from '@/components/dashboard/chart-card'
import { useAlertSummary } from '@/hooks/use-dashboard'
import { formatBusinessDate, formatInteger, humanize } from '@/lib/format'
import { cn } from '@/lib/utils'

/**
 * The alerts inbox header.
 *
 * Not a chart — four counts and a handful of messages are a list, and drawing
 * them as bars would add ink without adding information. It wears `ChartCard`
 * anyway because it is refreshable and its age matters just as much: an alert
 * panel that is quietly ten minutes stale is worse than no alert panel.
 *
 * Rule types that fired zero times are still listed, greyed. The evaluator has
 * four rules, and "vaccination due: 0" is a claim the farm should be able to
 * read; omitting the row makes a rule that never fires indistinguishable from
 * one that does not exist.
 */

const STATUS_TONE: Record<string, string> = {
  open: 'text-alert',
  acknowledged: 'text-ink',
  resolved: 'text-gain',
}

export function AlertSummaryPanel() {
  const query = useAlertSummary()
  const summary = query.data

  const statuses = Object.entries(summary?.by_status ?? {})
  const types = Object.entries(summary?.by_type ?? {})
  const recent = summary?.recent ?? []

  return (
    <ChartCard
      title="Alerts"
      hint="Raised by the rule engine over the whole herd, not just this window"
      query={query}
      isEmpty={statuses.length === 0}
      emptyMessage="The rule engine has raised nothing."
    >
      <div className="space-y-5">
        <dl className="grid grid-cols-3 gap-4">
          {statuses.map(([status, count]) => (
            <div key={status} className="border-t border-rule pt-3">
              <dt className="eyebrow">{humanize(status)}</dt>
              <dd className={cn('figure mt-1 text-2xl', STATUS_TONE[status] ?? 'text-ink')}>
                {formatInteger(count)}
              </dd>
            </div>
          ))}
        </dl>

        <div>
          <p className="eyebrow mb-2">By rule</p>
          <dl className="space-y-1.5">
            {types.map(([type, count]) => (
              <div key={type} className="flex items-baseline justify-between gap-4">
                <dt className={cn('text-sm', count > 0 ? 'text-ink' : 'text-muted')}>
                  {humanize(type)}
                </dt>
                <dd className={cn('figure text-sm', count > 0 ? 'text-ink' : 'text-muted')}>
                  {formatInteger(count)}
                </dd>
              </div>
            ))}
          </dl>
        </div>

        {recent.length > 0 ? (
          <div>
            <p className="eyebrow mb-2">Most recent</p>
            <ul className="space-y-2.5">
              {recent.map((alert) => (
                <li key={alert.id} className="border-t border-rule pt-2.5">
                  <p className="text-sm text-ink">{alert.message}</p>
                  <p className="mt-0.5 text-xs text-muted">
                    {humanize(alert.alert_type)} · {formatBusinessDate(alert.alert_date)}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </ChartCard>
  )
}
