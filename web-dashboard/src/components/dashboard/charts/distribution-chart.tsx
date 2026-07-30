'use client'

import type { UseQueryResult } from '@tanstack/react-query'
import { Bar, BarChart, CartesianGrid, LabelList, Tooltip, XAxis, YAxis } from 'recharts'

import { ChartCard } from '@/components/dashboard/chart-card'
import {
  AXIS_PROPS,
  CHART_COLORS,
  ChartFrame,
  GRID_PROPS,
  TooltipShell,
} from '@/components/dashboard/charts/chart-primitives'
import { useBreedDistribution, useProductionClassDistribution } from '@/hooks/use-dashboard'
import type { Distribution } from '@/lib/api/types'
import { formatInteger, formatNumber, formatPercent } from '@/lib/format'

/**
 * Herd composition, grouped by whatever the endpoint grouped it by.
 *
 * Breed and production class return the identical shape, so they share one
 * chart. What differs is the ordering, and that is not cosmetic: breed has no
 * natural sequence and is therefore ranked by size, while production class runs
 * piglet → boar, which is the animal's own progression. Sorting the lifecycle
 * by headcount would scramble the one axis that already means something.
 *
 * Horizontal bars because the category labels are words. Rotated tick labels
 * under vertical bars are harder to read and cost more vertical space than the
 * bars themselves.
 */

export const PRODUCTION_CLASS_ORDER = [
  'piglet',
  'weaner',
  'grower',
  'finisher',
  'gilt',
  'sow',
  'boar',
] as const

function label(key: string): string {
  return key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' ')
}

export function BreedDistributionChart() {
  return (
    <DistributionChart
      title="Breed composition"
      hint="Active hogs by breed, largest first"
      query={useBreedDistribution()}
      order="count"
      emptyMessage="No hogs on record yet."
    />
  )
}

export function ProductionClassDistributionChart() {
  return (
    <DistributionChart
      title="Herd composition"
      hint="Active hogs by production class, youngest first"
      query={useProductionClassDistribution()}
      order={PRODUCTION_CLASS_ORDER}
      emptyMessage="No hogs on record yet."
    />
  )
}

export function DistributionChart({
  title,
  hint,
  query,
  order = 'count',
  emptyMessage,
}: {
  title: string
  hint?: string
  query: UseQueryResult<Distribution, Error>
  /** `'count'` ranks by headcount; an array fixes an explicit sequence. */
  order?: 'count' | readonly string[]
  emptyMessage?: string
}) {
  const rows = query.data?.rows ?? []
  const totalHogs = query.data?.total_hogs ?? 0

  const sorted = [...rows].sort((a, b) => {
    if (order === 'count') return b.hog_count - a.hog_count
    // Anything the backend grows later that this list has not been told about
    // sorts to the end rather than silently to the front.
    const rank = (key: string) => {
      const index = order.indexOf(key)
      return index === -1 ? order.length : index
    }
    return rank(a.key) - rank(b.key)
  })

  const data = sorted.map((row) => ({
    key: row.key,
    label: label(row.key),
    hogCount: row.hog_count,
    avgWeight: row.avg_weight_kg,
    avgAdg: row.avg_adg_kg_per_day,
    share: totalHogs > 0 ? (row.hog_count / totalHogs) * 100 : null,
  }))

  return (
    <ChartCard
      title={title}
      hint={hint}
      query={query}
      isEmpty={data.length === 0}
      emptyMessage={emptyMessage}
    >
      <ChartFrame height={Math.max(180, data.length * 34 + 32)}>
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 0, right: 32, bottom: 0, left: 0 }}
          barCategoryGap="22%"
        >
          <CartesianGrid {...GRID_PROPS} horizontal={false} vertical />
          <XAxis type="number" hide />
          <YAxis
            type="category"
            dataKey="label"
            {...AXIS_PROPS}
            width={84}
            axisLine={false}
            interval={0}
          />
          <Tooltip
            cursor={{ fill: 'var(--color-raised)' }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null
              const point = payload[0].payload as (typeof data)[number]
              return (
                <TooltipShell
                  title={point.label}
                  rows={[
                    { label: 'Hogs', value: formatInteger(point.hogCount) },
                    { label: 'Share of herd', value: formatPercent(point.share) },
                    { label: 'Mean weight', value: `${formatNumber(point.avgWeight, 1)} kg` },
                    { label: 'Mean daily gain', value: `${formatNumber(point.avgAdg)} kg/day` },
                  ]}
                />
              )
            }}
          />
          <Bar
            dataKey="hogCount"
            fill={CHART_COLORS[0]}
            radius={[0, 3, 3, 0]}
            isAnimationActive={false}
          >
            <LabelList
              dataKey="hogCount"
              position="right"
              className="figure"
              fill="var(--color-muted)"
              fontSize={11}
            />
          </Bar>
        </BarChart>
      </ChartFrame>
    </ChartCard>
  )
}
