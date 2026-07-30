import { useDashboardViewModel } from '../viewmodels/useDashboardViewModel'

export default function Dashboard() {
  const { kpis, error, loading } = useDashboardViewModel()

  return (
    <div className="page">
      <h2>Dashboard KPIs</h2>
      {error ? (
        <p className="error">{error}</p>
      ) : loading ? (
        <p>Loading KPIs...</p>
      ) : kpis ? (
        <div className="card-grid">
          <div className="card">
            <h3>Health records</h3>
            <p>{kpis.health_records_count ?? '—'}</p>
          </div>
          <div className="card">
            <h3>Feed records</h3>
            <p>{kpis.feed_records_count ?? '—'}</p>
          </div>
          <div className="card">
            <h3>Hogs</h3>
            <p>{kpis.active_hogs_count ?? '—'}</p>
          </div>
        </div>
      ) : null}
    </div>
  )
}
