import { FarmOverview } from '@/components/dashboard/farm-overview'
import { KpiRow } from '@/components/dashboard/kpi-row'

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <p className="eyebrow">Overview</p>
        <h1 className="text-xl font-semibold tracking-tight text-ink">Dashboard</h1>
      </div>

      <KpiRow />
      <FarmOverview />
    </div>
  )
}
