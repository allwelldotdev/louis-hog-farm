'use client'

import { Bar, CartesianGrid, ComposedChart, Line, Tooltip, XAxis, YAxis } from 'recharts'

import { ChartCard } from '@/components/dashboard/chart-card'
import {
  AXIS_PROPS,
  CHART_COLORS,
  CURSOR_PROPS,
  ChartFrame,
  ChartLegend,
  GRID_PROPS,
  TooltipShell,
} from '@/components/dashboard/charts/chart-primitives'
import { useFeedCostSeries } from '@/hooks/use-dashboard'
import { formatBusinessDate, formatMoney, formatMoneyCompact, formatNumber } from '@/lib/format'

/**
 * What the feed cost, and what it bought.
 *
 * Two axes because the two figures answer different questions. Spend per bucket
 * is a budget line and rises simply because the herd is growing; cost per kg of
 * gain is the efficiency figure, and it is the one that should be flat or
 * falling. Plotting spend alone would make a well-run farm look like it is
 * losing control of costs.
 *
 * The first bucket has no cost-per-kg-gain: there is no earlier weight to
 * measure gain against. It is left as a gap rather than zero — `connectNulls`
 * stays off so the line starts where the measurement does.
 */
export function FeedCostChart() {
  const query = useFeedCostSeries()
  const points = query.data?.points ?? []
  const currency = query.data?.currency_code ?? 'NGN'

  const data = points.map((point) => ({
    bucket: point.bucket,
    feedKg: point.feed_kg,
    feedCost: point.feed_cost,
    costPerKgGain: point.cost_per_kg_gain,
  }))

  return (
    <ChartCard
      title="Feed cost"
      hint={query.data ? `Spend and cost per kg of gain, by ${query.data.interval}` : undefined}
      query={query}
      isEmpty={data.length === 0}
      emptyMessage="No feed recorded in this window."
    >
      <ChartFrame>
        <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid {...GRID_PROPS} />
          <XAxis
            dataKey="bucket"
            {...AXIS_PROPS}
            tickFormatter={(value: string) => formatBusinessDate(value)}
            minTickGap={24}
          />
          <YAxis
            yAxisId="spend"
            {...AXIS_PROPS}
            width={56}
            tickFormatter={(value: number) => formatMoneyCompact(value, currency)}
          />
          <YAxis
            yAxisId="efficiency"
            orientation="right"
            {...AXIS_PROPS}
            width={56}
            tickFormatter={(value: number) => formatMoneyCompact(value, currency)}
          />
          <Tooltip
            cursor={CURSOR_PROPS}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null
              const point = payload[0].payload as (typeof data)[number]
              return (
                <TooltipShell
                  title={formatBusinessDate(point.bucket, { dateStyle: 'medium' })}
                  rows={[
                    {
                      label: 'Feed cost',
                      value: formatMoney(point.feedCost, currency),
                      color: CHART_COLORS[1],
                    },
                    {
                      label: 'Cost per kg gain',
                      value: formatMoney(point.costPerKgGain, currency),
                      color: CHART_COLORS[0],
                    },
                    { label: 'Feed consumed', value: `${formatNumber(point.feedKg, 0)} kg` },
                  ]}
                />
              )
            }}
          />

          <Bar
            yAxisId="spend"
            dataKey="feedCost"
            fill={CHART_COLORS[1]}
            fillOpacity={0.55}
            radius={[3, 3, 0, 0]}
            isAnimationActive={false}
          />
          <Line
            yAxisId="efficiency"
            dataKey="costPerKgGain"
            stroke={CHART_COLORS[0]}
            strokeWidth={2}
            dot={false}
            connectNulls={false}
            activeDot={{
              r: 4,
              fill: CHART_COLORS[0],
              stroke: 'var(--color-ground)',
              strokeWidth: 2,
            }}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ChartFrame>

      <ChartLegend
        items={[
          { label: 'Feed cost (left)', color: CHART_COLORS[1] },
          { label: 'Cost per kg gain (right)', color: CHART_COLORS[0] },
        ]}
      />
    </ChartCard>
  )
}
