import { Suspense } from 'react'

import { ClientOnly } from '@/components/client-only'
import { ExportsView } from '@/components/exports/exports-view'

function Skeleton() {
  return <div className="h-96 animate-pulse rounded-card bg-surface" />
}

export default function ExportsPage() {
  return (
    <Suspense fallback={<Skeleton />}>
      <ClientOnly fallback={<Skeleton />}>
        <ExportsView />
      </ClientOnly>
    </Suspense>
  )
}
