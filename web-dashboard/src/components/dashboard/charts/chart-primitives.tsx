'use client'

import { ResponsiveContainer } from 'recharts'

/**
 * The shared vocabulary every chart on the dashboard draws with.
 *
 * Colours are the `--color-chart-*` custom properties rather than hex literals,
 * so a series colour is the same token the UI uses and cannot drift from the
 * palette — which is the whole reason those tokens sit in `globals.css` beside
 * the surface colours. SVG resolves `var()` in `fill` and `stroke` natively, so
 * this needs no JavaScript theme plumbing.
 */
export const CHART_COLORS = [
  'var(--color-chart-1)',
  'var(--color-chart-2)',
  'var(--color-chart-3)',
  'var(--color-chart-4)',
  'var(--color-chart-5)',
] as const

export const AXIS_PROPS = {
  tick: { fill: 'var(--color-muted)', fontSize: 11 },
  tickLine: false,
  axisLine: { stroke: 'var(--color-rule)' },
} as const

export const GRID_PROPS = {
  stroke: 'var(--color-rule)',
  strokeDasharray: '2 4',
  vertical: false,
} as const

/** The hairline that follows the pointer. Ochre so it reads as "you are reading
 *  this bucket" rather than as another series. */
export const CURSOR_PROPS = {
  stroke: 'var(--color-ochre)',
  strokeOpacity: 0.4,
  strokeWidth: 1,
} as const

export function ChartFrame({
  height = 288,
  children,
}: {
  height?: number
  children: React.ReactElement
}) {
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        {children}
      </ResponsiveContainer>
    </div>
  )
}

/**
 * The tooltip's shell.
 *
 * Only the presentation is shared: each chart formats its own rows, because
 * only the chart knows whether a number is kilograms, a count, or money in the
 * farm's currency. A single clever formatter here would have to be told all of
 * that anyway.
 */
export function TooltipShell({
  title,
  rows,
}: {
  title: string
  rows: { label: string; value: string; color?: string }[]
}) {
  return (
    <div className="rounded-control border border-rule-strong bg-raised px-3 py-2 shadow-lg">
      <p className="mb-1.5 text-xs font-medium text-ink">{title}</p>
      <dl className="space-y-1">
        {rows.map((row) => (
          <div key={row.label} className="flex items-baseline justify-between gap-4 text-xs">
            <dt className="flex items-center gap-1.5 text-muted">
              {row.color ? (
                <span
                  className="size-2 shrink-0 rounded-full"
                  style={{ backgroundColor: row.color }}
                  aria-hidden
                />
              ) : null}
              {row.label}
            </dt>
            <dd className="figure text-ink">{row.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

/** The key beneath a chart. Recharts' own `Legend` renders outside the card's
 *  type scale; this keeps the labels in the same voice as the rest of the UI. */
export function ChartLegend({
  items,
}: {
  items: { label: string; color: string; muted?: boolean }[]
}) {
  return (
    <ul className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5">
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-1.5 text-xs text-muted">
          <span
            className="h-0.5 w-4 shrink-0 rounded-full"
            style={{ backgroundColor: item.color, opacity: item.muted ? 0.35 : 1 }}
            aria-hidden
          />
          {item.label}
        </li>
      ))}
    </ul>
  )
}
