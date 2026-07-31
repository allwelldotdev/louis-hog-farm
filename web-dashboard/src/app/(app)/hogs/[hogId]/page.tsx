import { notFound } from 'next/navigation'

import { ClientOnly } from '@/components/client-only'
import { HogDetail } from '@/components/hogs/hog-detail'

function DetailSkeleton() {
  return <div className="h-96 animate-pulse rounded-card bg-surface" />
}

/**
 * One animal.
 *
 * The id is validated here rather than in the client component: `/hogs/abc`
 * should be a 404 from the framework, not a request the API rejects and the UI
 * renders as an error card.
 */
export default async function HogDetailPage({ params }: { params: Promise<{ hogId: string }> }) {
  const { hogId } = await params
  const id = Number(hogId)
  if (!Number.isInteger(id) || id <= 0) notFound()

  return (
    <ClientOnly fallback={<DetailSkeleton />}>
      <HogDetail hogId={id} />
    </ClientOnly>
  )
}
