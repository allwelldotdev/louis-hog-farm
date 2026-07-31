import { Suspense } from 'react'

import { ClientOnly } from '@/components/client-only'
import { HealthRecordsView } from '@/components/records/health-records-view'

function Skeleton() {
  return <div className="h-96 animate-pulse rounded-card bg-surface" />
}

export default function HealthRecordsPage() {
  return (
    <Suspense fallback={<Skeleton />}>
      <ClientOnly fallback={<Skeleton />}>
        <HealthRecordsView />
      </ClientOnly>
    </Suspense>
  )
}
