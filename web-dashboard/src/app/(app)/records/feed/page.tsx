import { Suspense } from 'react'

import { ClientOnly } from '@/components/client-only'
import { FeedRecordsView } from '@/components/records/feed-records-view'

function Skeleton() {
  return <div className="h-96 animate-pulse rounded-card bg-surface" />
}

export default function FeedRecordsPage() {
  return (
    <Suspense fallback={<Skeleton />}>
      <ClientOnly fallback={<Skeleton />}>
        <FeedRecordsView />
      </ClientOnly>
    </Suspense>
  )
}
