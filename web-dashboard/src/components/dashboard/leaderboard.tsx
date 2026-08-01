'use client'

import { useState } from 'react'

import { ChartCard } from '@/components/dashboard/chart-card'
import { Select } from '@/components/ui/field'
import {
  useLeaderboard,
  type LeaderboardDirection,
  type LeaderboardMetric,
} from '@/hooks/use-dashboard'
import { formatInteger, formatNumber, humanize } from '@/lib/format'
import { cn } from '@/lib/utils'

/**
 * Best and worst performers over the window — where `underperformers` moved to
 * when it came out of the KPI payload, because it was always a ranking rather
 * than a headline figure.
 *
 * `is_underperformer` is judged per production class, at 0.85× the mean daily
 * gain for the animal's own class. A herd-wide floor flagged most of a
 * piglet-heavy herd, which is wrong: a piglet gaining 0.2 kg/day is performing
 * normally for a piglet. The flag drives the row emphasis rather than any
 * client-side threshold, so the screen and the API cannot disagree about who is
 * behind.
 */

const METRIC_LABEL: Record<LeaderboardMetric, string> = {
  adg: 'Daily gain',
  gain: 'Total gain',
  fcr: 'Feed conversion',
}

const LIMIT = 10

export function Leaderboard() {
  const [metric, setMetric] = useState<LeaderboardMetric>('adg')
  const [direction, setDirection] = useState<LeaderboardDirection>('top')

  const query = useLeaderboard({ metric, direction, limit: LIMIT })
  const rows = query.data?.rows ?? []

  return (
    <ChartCard
      title="Performance leaderboard"
      hint={`${direction === 'top' ? 'Best' : 'Weakest'} by ${METRIC_LABEL[metric].toLowerCase()}; flagged animals are below 0.85× their own class mean`}
      query={query}
      isEmpty={rows.length === 0}
      emptyMessage="No animal was weighed twice in this window."
      actions={
        <>
          <Select
            className="h-8 text-xs"
            aria-label="Rank by"
            value={metric}
            onChange={(event) => setMetric(event.target.value as LeaderboardMetric)}
          >
            {Object.entries(METRIC_LABEL).map(([value, text]) => (
              <option key={value} value={value}>
                {text}
              </option>
            ))}
          </Select>
          <Select
            className="h-8 text-xs"
            aria-label="Direction"
            value={direction}
            onChange={(event) => setDirection(event.target.value as LeaderboardDirection)}
          >
            <option value="top">Top</option>
            <option value="bottom">Bottom</option>
          </Select>
        </>
      }
    >
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-rule text-left">
              <th className="eyebrow py-2 pr-4 font-semibold">Tag</th>
              <th className="eyebrow py-2 pr-4 font-semibold">Breed</th>
              <th className="eyebrow py-2 pr-4 font-semibold">Class</th>
              <th className="eyebrow py-2 pr-4 text-right font-semibold">Daily gain</th>
              <th className="eyebrow py-2 pr-4 text-right font-semibold">Gain</th>
              <th className="eyebrow py-2 pr-4 text-right font-semibold">Feed</th>
              <th className="eyebrow py-2 text-right font-semibold">FCR</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.hog_id}
                className={cn(
                  'border-b border-rule/60 last:border-0',
                  // A left rule rather than a tinted row: the emphasis has to
                  // survive beside seven columns of figures without making the
                  // numbers themselves harder to read.
                  row.is_underperformer && 'border-l-2 border-l-alert',
                )}
              >
                <td className={cn('py-2.5 pr-4', row.is_underperformer && 'pl-2')}>
                  <span className="figure text-ink">{row.tag_number}</span>
                  {row.is_underperformer ? (
                    <span className="ml-2 rounded-sm bg-alert-wash px-1.5 py-0.5 text-[0.6875rem] text-alert">
                      Behind
                    </span>
                  ) : null}
                </td>
                <td className="py-2.5 pr-4 text-muted">{row.breed}</td>
                <td className="py-2.5 pr-4 text-muted">{humanize(row.production_class)}</td>
                <td className="figure py-2.5 pr-4 text-right text-ink">
                  {formatNumber(row.adg_kg_per_day)}
                </td>
                <td className="figure py-2.5 pr-4 text-right text-ink">
                  {formatNumber(row.weight_gain_kg, 1)}
                </td>
                <td className="figure py-2.5 pr-4 text-right text-muted">
                  {formatNumber(row.feed_kg, 0)}
                </td>
                <td className="figure py-2.5 text-right text-ink">{formatNumber(row.fcr)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-3 text-xs text-muted">
          Over {formatInteger(rows[0]?.days)} days · gain and feed in kg
        </p>
      </div>
    </ChartCard>
  )
}
