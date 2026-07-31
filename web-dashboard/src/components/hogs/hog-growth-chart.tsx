'use client'

import { useMemo } from 'react'
import { CartesianGrid, ComposedChart, Line, Tooltip, XAxis, YAxis } from 'recharts'

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
import { useHogGrowth } from '@/hooks/use-hogs'
import { useHealthRecords } from '@/hooks/use-records'
import { NO_VALUE, formatBusinessDate, formatNumber } from '@/lib/format'

/**
 * One animal's weight over time, with its recorded temperature behind it.
 *
 * This is the chart the herd dashboard cannot draw. Stall, decline and
 * illness-then-recovery are per-animal shapes; averaged across sixty hogs they
 * vanish into the percentile band. Weight comes from `GET /hogs/{id}/growth`,
 * the API's only per-animal series.
 *
 * Temperature is drawn from the same weigh-in records on a second axis, because
 * the illness archetype is a weight dip *and* a fever at the same date — two
 * separate charts would leave the reader correlating them by eye. It is the
 * secondary series in every respect: thin, dashed, right-hand axis, and absent
 * entirely when nothing was taken.
 */
export function HogGrowthChart({ hogId }: { hogId: number }) {
  const query = useHogGrowth(hogId)
  const health = useHealthRecords({ hogId })

  const data = useMemo(() => {
    const temperatureByDate = new Map(
      (health.data?.items ?? [])
        .filter((record) => record.temperature !== null)
        .map((record) => [record.record_date, Number(record.temperature)]),
    )

    return (query.data?.actual ?? []).map((point) => ({
      date: point.date,
      weight: point.weight_kg,
      temperature: temperatureByDate.get(point.date) ?? null,
    }))
  }, [query.data, health.data])

  const hasTemperature = data.some((point) => point.temperature !== null)

  return (
    <ChartCard
      title="Growth"
      hint={
        hasTemperature
          ? 'Recorded weight, with body temperature behind it'
          : 'Recorded weight at each weigh-in'
      }
      query={query}
      isEmpty={data.length === 0}
      emptyMessage="This animal has never been weighed."
    >
      <ChartFrame>
        <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid {...GRID_PROPS} />
          <XAxis
            dataKey="date"
            {...AXIS_PROPS}
            tickFormatter={(value: string) => formatBusinessDate(value)}
            minTickGap={24}
          />
          <YAxis
            yAxisId="weight"
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
          {hasTemperature ? (
            <YAxis
              yAxisId="temperature"
              orientation="right"
              {...AXIS_PROPS}
              width={40}
              // A pig's normal range is roughly 38.0–39.5 °C, so an axis from
              // zero would flatten a two-degree fever into a straight line.
              domain={['dataMin - 0.5', 'dataMax + 0.5']}
              tickFormatter={(value: number) => formatNumber(value, 1)}
              label={{
                value: '°C',
                position: 'insideTopRight',
                fill: 'var(--color-muted)',
                fontSize: 11,
              }}
            />
          ) : null}

          <Tooltip
            cursor={CURSOR_PROPS}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null
              const point = payload[0].payload as (typeof data)[number]
              return (
                <TooltipShell
                  title={formatBusinessDate(point.date, { dateStyle: 'medium' })}
                  rows={[
                    {
                      label: 'Weight',
                      value: `${formatNumber(point.weight, 1)} kg`,
                      color: CHART_COLORS[0],
                    },
                    ...(hasTemperature
                      ? [
                          {
                            label: 'Temperature',
                            value:
                              point.temperature === null
                                ? NO_VALUE
                                : `${formatNumber(point.temperature, 1)} °C`,
                            color: CHART_COLORS[3],
                          },
                        ]
                      : []),
                  ]}
                />
              )
            }}
          />

          {hasTemperature ? (
            <Line
              yAxisId="temperature"
              dataKey="temperature"
              stroke={CHART_COLORS[3]}
              strokeWidth={1.5}
              strokeDasharray="4 3"
              dot={false}
              connectNulls
              isAnimationActive={false}
            />
          ) : null}
          <Line
            yAxisId="weight"
            dataKey="weight"
            stroke={CHART_COLORS[0]}
            strokeWidth={2}
            dot={{ r: 2, fill: CHART_COLORS[0], strokeWidth: 0 }}
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
          { label: 'Weight', color: CHART_COLORS[0] },
          ...(hasTemperature
            ? [{ label: 'Temperature', color: CHART_COLORS[3], muted: true }]
            : []),
        ]}
      />
    </ChartCard>
  )
}
