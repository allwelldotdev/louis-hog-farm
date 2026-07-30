'use client'

import { SignOutButton } from '@/components/app-shell/sign-out-button'
import { useFarm } from '@/hooks/use-farm'

export function Topbar() {
  const { data: farm, isPending } = useFarm()

  return (
    <header className="flex items-center justify-between gap-4 border-b border-rule px-6 py-3.5">
      <div className="min-w-0">
        <p className="eyebrow">Farm</p>
        <p className="truncate text-sm font-medium text-ink">
          {isPending ? (
            <span className="inline-block h-4 w-32 animate-pulse rounded bg-raised align-middle" />
          ) : (
            (farm?.name ?? 'Unavailable')
          )}
        </p>
      </div>

      <SignOutButton />
    </header>
  )
}
