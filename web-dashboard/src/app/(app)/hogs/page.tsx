import { Suspense } from 'react'

import { ClientOnly } from '@/components/client-only'
import { HogsTable } from '@/components/hogs/hogs-table'

function TableSkeleton() {
  return <div className="h-96 animate-pulse rounded-card bg-surface" />
}

/**
 * The herd roster.
 *
 * Same two wrappers as the dashboard and for the same two reasons: the facets
 * live in the URL, and `useSearchParams` opts the subtree out of prerendering;
 * and the persisted query cache is invisible to the server, so markup that
 * depends on whether the list has loaded cannot be server-rendered honestly.
 */
export default function HogsPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <p className="eyebrow">Herd</p>
        <h1 className="text-xl font-semibold tracking-tight text-ink">Hogs</h1>
      </div>

      <Suspense fallback={<TableSkeleton />}>
        <ClientOnly fallback={<TableSkeleton />}>
          <HogsTable />
        </ClientOnly>
      </Suspense>
    </div>
  )
}
