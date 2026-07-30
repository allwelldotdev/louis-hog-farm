'use client'

import { Area, CartesianGrid, ComposedChart, Line, Tooltip, XAxis, YAxis } from 'recharts'

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
import { useHerdGrowth } from '@/hooks/use-dashboard'
import { formatBusinessDate, formatInteger, formatNumber } from '@/lib/format'

/**
 * The dashboard's headline chart: median herd weight with the tenth-to-ninetieth
 * percentile either side.
 *
 * The band is the argument for this chart over a plain average line. A herd
 * whose mean rises while its bottom decile flattens has animals falling behind,
 * and an average alone hides exactly that — which is the case the farm most
 * needs to see. The mean is drawn too, dashed and secondary: where it sits well
 * above the median, a few heavy finishers are carrying the figure.
 *
 * `band` is a two-element array because Recharts reads an array-valued dataKey
 * as a range and fills between the pair, rather than from a baseline.
 */
export function HerdGrowthChart() {
  const query = useHerdGrowth()
  const points = query.data?.points ?? []

  const data = points.map((point) => ({
    bucket: point.bucket,
    band: [point.p10_weight_kg, point.p90_weight_kg] as [number, number],
    p10: point.p10_weight_kg,
    p90: point.p90_weight_kg,
    median: point.median_weight_kg,
    average: point.avg_weight_kg,
    hogCount: point.hog_count,
  }))

  return (
    <ChartCard
      title="Herd growth"
      hint={
        query.data
          ? `Median weight and the 10th–90th percentile band, by ${query.data.interval}`
          : undefined
      }
      query={query}
      isEmpty={data.length === 0}
      emptyMessage="No weigh-ins recorded in this window."
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
          {/* The unit belongs on the axis once, not repeated on every tick —
              per-tick units wrap the label onto two lines and steal the width
              the plot needs. */}
          <YAxis
            {...AXIS_PROPS}
            width={40}
            tickFormatter={(value: number) => formatNumber(value, 0)}
            label={{
              value: 'kg',
              position: 'insideTopLeft',
              fill: 'var(--color-muted)',
              fontSize: 11,
            }}
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
                      label: 'Median',
                      value: `${formatNumber(point.median, 1)} kg`,
                      color: CHART_COLORS[0],
                    },
                    {
                      label: 'Mean',
                      value: `${formatNumber(point.average, 1)} kg`,
                      color: CHART_COLORS[1],
                    },
                    { label: '90th percentile', value: `${formatNumber(point.band[1], 1)} kg` },
                    { label: '10th percentile', value: `${formatNumber(point.band[0], 1)} kg` },
                    { label: 'Hogs weighed', value: formatInteger(point.hogCount) },
                  ]}
                />
              )
            }}
          />

          <Area
            dataKey="band"
            stroke="none"
            fill={CHART_COLORS[0]}
            fillOpacity={0.12}
            isAnimationActive={false}
          />
          {/* The band's own edges. Without them a wide spread reads as a solid
              block of fill rather than as two percentiles with a gap between,
              and the shape of the herd — which edge is moving — is lost. */}
          {(['p90', 'p10'] as const).map((edge) => (
            <Line
              key={edge}
              dataKey={edge}
              stroke={CHART_COLORS[0]}
              strokeOpacity={0.45}
              strokeWidth={1}
              dot={false}
              isAnimationActive={false}
            />
          ))}
          <Line
            dataKey="average"
            stroke={CHART_COLORS[1]}
            strokeWidth={1.5}
            strokeDasharray="4 3"
            dot={false}
            isAnimationActive={false}
          />
          <Line
            dataKey="median"
            stroke={CHART_COLORS[0]}
            strokeWidth={2}
            dot={false}
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
          { label: 'Median weight', color: CHART_COLORS[0] },
          { label: 'Mean weight', color: CHART_COLORS[1] },
          { label: '10th–90th percentile', color: CHART_COLORS[0], muted: true },
        ]}
      />
    </ChartCard>
  )
}
