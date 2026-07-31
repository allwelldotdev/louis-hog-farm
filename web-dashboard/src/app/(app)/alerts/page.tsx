import { Suspense } from 'react'

import { AlertsView } from '@/components/alerts/alerts-view'
import { ClientOnly } from '@/components/client-only'

function Skeleton() {
  return <div className="h-96 animate-pulse rounded-card bg-surface" />
}

export default function AlertsPage() {
  return (
    <Suspense fallback={<Skeleton />}>
      <ClientOnly fallback={<Skeleton />}>
        <AlertsView />
      </ClientOnly>
    </Suspense>
  )
}
