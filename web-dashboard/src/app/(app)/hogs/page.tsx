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
 *
 * The heading lives inside `HogsTable` rather than here, as it does on the
 * record pages: the Add button belongs beside it and has to know the role,
 * which is a client concern.
 */
export default function HogsPage() {
  return (
    <Suspense fallback={<TableSkeleton />}>
      <ClientOnly fallback={<TableSkeleton />}>
        <HogsTable />
      </ClientOnly>
    </Suspense>
  )
}
