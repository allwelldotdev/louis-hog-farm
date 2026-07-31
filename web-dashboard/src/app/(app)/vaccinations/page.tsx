import { Suspense } from 'react'

import { ClientOnly } from '@/components/client-only'
import { VaccinationsView } from '@/components/vaccinations/vaccinations-view'

function Skeleton() {
  return <div className="h-96 animate-pulse rounded-card bg-surface" />
}

export default function VaccinationsPage() {
  return (
    <Suspense fallback={<Skeleton />}>
      <ClientOnly fallback={<Skeleton />}>
        <VaccinationsView />
      </ClientOnly>
    </Suspense>
  )
}
