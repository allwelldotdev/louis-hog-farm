import { Suspense } from 'react'

import { ClientOnly } from '@/components/client-only'
import { MortalityView } from '@/components/mortality/mortality-view'

function Skeleton() {
  return <div className="h-96 animate-pulse rounded-card bg-surface" />
}

export default function MortalityPage() {
  return (
    <Suspense fallback={<Skeleton />}>
      <ClientOnly fallback={<Skeleton />}>
        <MortalityView />
      </ClientOnly>
    </Suspense>
  )
}
