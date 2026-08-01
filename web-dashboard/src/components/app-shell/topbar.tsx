'use client'

import { SignOutButton } from '@/components/app-shell/sign-out-button'
import { ThemeToggle } from '@/components/app-shell/theme-toggle'
import { useCurrentUser } from '@/hooks/use-current-user'
import { useFarm } from '@/hooks/use-farm'
import { ROLE_LABELS } from '@/lib/auth/permissions'

function Skeleton({ className }: { className: string }) {
  return (
    <span className={`inline-block animate-pulse rounded bg-raised align-middle ${className}`} />
  )
}

export function Topbar() {
  const { data: farm, isPending: farmPending } = useFarm()
  const { data: user, isPending: userPending } = useCurrentUser()

  return (
    <header className="flex items-center justify-between gap-4 border-b border-rule px-6 py-3.5">
      <div className="min-w-0">
        <p className="eyebrow">Farm</p>
        <p className="truncate text-sm font-medium text-ink">
          {farmPending ? <Skeleton className="h-4 w-32" /> : (farm?.name ?? 'Unavailable')}
        </p>
      </div>

      <div className="flex items-center gap-4">
        {/* The role is shown rather than merely enforced: a viewer who cannot
            find the "Add hog" button should be able to see why. */}
        <div className="hidden min-w-0 text-right sm:block">
          <p className="eyebrow">{user ? ROLE_LABELS[user.role] : 'Signed in'}</p>
          <p className="truncate text-sm font-medium text-ink">
            {userPending ? <Skeleton className="h-4 w-24" /> : (user?.full_name ?? 'Unknown')}
          </p>
        </div>

        <div className="flex items-center gap-1">
          <ThemeToggle />
          <SignOutButton />
        </div>
      </div>
    </header>
  )
}
