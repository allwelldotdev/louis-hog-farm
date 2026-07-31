import { Suspense } from 'react'

import { BreedingView } from '@/components/breeding/breeding-view'
import { ClientOnly } from '@/components/client-only'

function Skeleton() {
  return <div className="h-96 animate-pulse rounded-card bg-surface" />
}

export default function BreedingPage() {
  return (
    <Suspense fallback={<Skeleton />}>
      <ClientOnly fallback={<Skeleton />}>
        <BreedingView />
      </ClientOnly>
    </Suspense>
  )
}
