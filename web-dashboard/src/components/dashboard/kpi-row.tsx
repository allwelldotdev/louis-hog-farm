'use client'

import { ChartCard } from '@/components/dashboard/chart-card'
import { MetricCard, type MetricTone } from '@/components/dashboard/metric-card'
import { useKpis } from '@/hooks/use-dashboard'
import { useFarm } from '@/hooks/use-farm'
import {
  formatBusinessDate,
  formatInteger,
  formatMoney,
  formatNumber,
  formatPercent,
} from '@/lib/format'

/**
 * The headline figures from `GET /dashboard/kpis`.
 *
 * Every null here is meaningful and must survive to the screen as "—": a null
 * ADG means no animal was weighed twice in the window, and a zero would report
 * a herd that stopped growing. The formatters handle that; the tiles must not
 * substitute defaults of their own.
 *
 * Money is formatted against the farm's `currency_code` rather than a locale
 * guess — the backend locks a farm to one currency precisely so this figure can
 * be a single number instead of a per-currency breakdown.
 */
export function KpiRow() {
  const query = useKpis()
  const { data: farm } = useFarm()
  const kpis = query.data
  const currency = kpis?.currency_code ?? farm?.currency_code ?? 'NGN'

  const tiles: {
    label: string
    value: string
    unit?: string
    detail?: string
    tone?: MetricTone
  }[] = [
    {
      label: 'Average daily gain',
      value: formatNumber(kpis?.avg_daily_gain_kg),
      unit: 'kg/day',
      detail: kpis ? `${formatInteger(kpis.hogs_with_growth_measure)} hogs measured` : undefined,
    },
    {
      label: 'Total weight gain',
      value: formatNumber(kpis?.total_weight_gain_kg, 0),
      unit: 'kg',
    },
    {
      label: 'Feed conversion',
      value: formatNumber(kpis?.fcr),
      unit: 'kg feed / kg gain',
    },
    {
      label: 'Cost per kg gain',
      value: formatMoney(kpis?.feed_cost_per_kg_gain, currency),
    },
    {
      label: 'Feed consumed',
      value: formatNumber(kpis?.total_feed_kg, 0),
      unit: 'kg',
      detail: kpis ? `${formatInteger(kpis.feed_records_count)} feed records` : undefined,
    },
    {
      label: 'Feed cost',
      value: formatMoney(kpis?.total_feed_cost, currency),
    },
    {
      label: 'Market ready',
      value: formatPercent(kpis?.market_ready_pct),
      detail: kpis
        ? `${formatInteger(kpis.market_ready_count)} of ${formatInteger(kpis.market_ready_measured_count)} at ${formatNumber(kpis.market_weight_kg, 0)} kg+`
        : undefined,
    },
    {
      label: 'Active hogs',
      value: formatInteger(kpis?.active_hogs_count),
      detail: kpis ? `${formatInteger(kpis.health_records_count)} health records` : undefined,
    },
    {
      label: 'Mortality',
      value: formatPercent(kpis?.mortality_rate_pct),
      detail: kpis ? `${formatInteger(kpis.mortality_count)} recorded` : undefined,
      tone: kpis && kpis.mortality_count > 0 ? 'alert' : 'default',
    },
    {
      label: 'Open alerts',
      value: formatInteger(kpis?.open_alerts_count),
      tone: kpis && kpis.open_alerts_count > 0 ? 'alert' : 'default',
    },
  ]

  return (
    <ChartCard
      title="Herd performance"
      hint={
        kpis
          ? `${formatBusinessDate(kpis.date_from)} – ${formatBusinessDate(kpis.date_to)}`
          : undefined
      }
      query={query}
    >
      <div className="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-3 lg:grid-cols-5">
        {tiles.map((tile) => (
          <MetricCard key={tile.label} {...tile} />
        ))}
      </div>
    </ChartCard>
  )
}
