import { redirect } from 'next/navigation'

import { DataVersionPoller } from '@/components/data-version-poller'
import { Sidebar } from '@/components/app-shell/sidebar'
import { Topbar } from '@/components/app-shell/topbar'
import { Toaster } from '@/components/toaster'
import { isSignedIn } from '@/lib/auth/session'
import { QueryProvider } from '@/lib/query/provider'

/**
 * The signed-in shell.
 *
 * `proxy.ts` already redirects anonymous visitors, so this second check is a
 * backstop rather than the gate: the route matcher is a regex, and a session
 * check that only lives in a regex is one config edit away from silently
 * letting everything through.
 *
 * Deliberately no data fetching here. Charts need refresh buttons, filters and
 * a client cache anyway, so everything is read client-side through TanStack
 * Query — mixing RSC fetching with query invalidation would leave two caches
 * with different invalidation stories and no clear owner.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  if (!(await isSignedIn())) {
    redirect('/')
  }

  return (
    <QueryProvider>
      <DataVersionPoller />
      <div className="flex min-h-dvh flex-col lg:flex-row">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar />
          <main className="flex-1 px-6 py-6">{children}</main>
        </div>
      </div>
      <Toaster />
    </QueryProvider>
  )
}
