import { Suspense } from 'react'

import { ClientOnly } from '@/components/client-only'
import { AlertSummaryPanel } from '@/components/dashboard/alert-summary-panel'
import {
  BreedDistributionChart,
  ProductionClassDistributionChart,
} from '@/components/dashboard/charts/distribution-chart'
import { FeedCostChart } from '@/components/dashboard/charts/feed-cost-chart'
import { HerdGrowthChart } from '@/components/dashboard/charts/herd-growth-chart'
import { WeightDistributionChart } from '@/components/dashboard/charts/weight-distribution-chart'
import { FarmOverview } from '@/components/dashboard/farm-overview'
import { FilterBar } from '@/components/dashboard/filter-bar'
import { KpiRow } from '@/components/dashboard/kpi-row'
import { Leaderboard } from '@/components/dashboard/leaderboard'

function BoardSkeleton() {
  return <div className="h-96 animate-pulse rounded-card bg-surface" />
}

/**
 * Everything below the heading reads the URL filters, and `useSearchParams`
 * opts a subtree out of prerendering, so the whole board sits behind one
 * Suspense boundary rather than each chart carrying its own.
 *
 * `ClientOnly` keeps the board out of the server render entirely — see its own
 * note: the persisted query cache is invisible to the server, so any markup
 * that depends on whether a query has data cannot be server-rendered honestly.
 */
export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <p className="eyebrow">Overview</p>
        <h1 className="text-xl font-semibold tracking-tight text-ink">Dashboard</h1>
      </div>

      <Suspense fallback={<BoardSkeleton />}>
        <ClientOnly fallback={<BoardSkeleton />}>
          <FilterBar />

          <div className="mt-6 space-y-6">
            <KpiRow />
            <HerdGrowthChart />

            <div className="grid gap-6 lg:grid-cols-2">
              <ProductionClassDistributionChart />
              <BreedDistributionChart />
            </div>

            <WeightDistributionChart />
            <Leaderboard />
            <FeedCostChart />

            <div className="grid gap-6 lg:grid-cols-2">
              <AlertSummaryPanel />
              <FarmOverview />
            </div>
          </div>
        </ClientOnly>
      </Suspense>
    </div>
  )
}
