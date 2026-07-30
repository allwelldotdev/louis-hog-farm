'use client'

import { Bar, BarChart, CartesianGrid, Tooltip, XAxis, YAxis } from 'recharts'

import { ChartCard } from '@/components/dashboard/chart-card'
import {
  AXIS_PROPS,
  CHART_COLORS,
  ChartFrame,
  GRID_PROPS,
  TooltipShell,
} from '@/components/dashboard/charts/chart-primitives'
import { useWeightDistribution } from '@/hooks/use-dashboard'
import { formatBusinessDate, formatInteger, formatNumber, formatPercent } from '@/lib/format'

/**
 * Where the herd sits today, by weight.
 *
 * The companion to the growth chart: growth shows the herd moving, this shows
 * its shape at one moment. A herd that is bimodal here — a cluster of piglets
 * and a cluster of finishers with a gap between — looks identical to an evenly
 * spread herd once averaged into a single line, which is the failure this
 * chart exists to catch.
 *
 * Each bar is one weight bucket, so the categories are ordered by definition
 * and no sorting decision arises.
 */
export function WeightDistributionChart() {
  const query = useWeightDistribution()
  const buckets = query.data?.buckets ?? []
  const totalHogs = query.data?.total_hogs ?? 0

  const data = buckets.map((bucket) => ({
    label: `${formatNumber(bucket.lower_kg, 0)}–${formatNumber(bucket.upper_kg, 0)}`,
    lower: bucket.lower_kg,
    upper: bucket.upper_kg,
    hogCount: bucket.hog_count,
    share: totalHogs > 0 ? (bucket.hog_count / totalHogs) * 100 : null,
  }))

  return (
    <ChartCard
      title="Weight distribution"
      hint={
        query.data
          ? `Latest weight per active hog, ${formatNumber(query.data.bucket_kg, 0)} kg buckets, as of ${formatBusinessDate(query.data.as_of)}`
          : undefined
      }
      query={query}
      isEmpty={data.length === 0}
      emptyMessage="No hog has a recorded weight yet."
    >
      <ChartFrame height={248}>
        <BarChart
          data={data}
          margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
          barCategoryGap="12%"
        >
          <CartesianGrid {...GRID_PROPS} />
          {/* The bucket bounds are already a range; repeating "kg" on nineteen
              of them says nothing the card's hint has not said once. */}
          <XAxis dataKey="label" {...AXIS_PROPS} interval={0} />
          <YAxis {...AXIS_PROPS} width={32} allowDecimals={false} />
          <Tooltip
            cursor={{ fill: 'var(--color-raised)' }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null
              const point = payload[0].payload as (typeof data)[number]
              return (
                <TooltipShell
                  title={`${formatNumber(point.lower, 0)}–${formatNumber(point.upper, 0)} kg`}
                  rows={[
                    { label: 'Hogs', value: formatInteger(point.hogCount) },
                    { label: 'Share of herd', value: formatPercent(point.share) },
                  ]}
                />
              )
            }}
          />
          <Bar
            dataKey="hogCount"
            fill={CHART_COLORS[0]}
            radius={[3, 3, 0, 0]}
            isAnimationActive={false}
          />
        </BarChart>
      </ChartFrame>
    </ChartCard>
  )
}
