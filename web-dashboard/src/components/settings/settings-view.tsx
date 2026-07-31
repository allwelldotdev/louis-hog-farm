'use client'

import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { usePermissions } from '@/hooks/use-current-user'
import { useFarm } from '@/hooks/use-farm'
import { useUsers } from '@/hooks/use-users'
import { ROLE_LABELS } from '@/lib/auth/permissions'
import { formatInteger } from '@/lib/format'
import { cn } from '@/lib/utils'

/**
 * Read-only, deliberately.
 *
 * The API exposes no `PATCH /farms`, and `POST /users` creates workers and
 * viewers only. Rendering an editable farm form against an endpoint that does
 * not exist would be a screen that looks like it works and does not, which is
 * worse than a page that states plainly what is fixed.
 */

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="eyebrow">{label}</dt>
      <dd className="mt-1 text-sm text-ink">{children}</dd>
    </div>
  )
}

export function SettingsView() {
  const farm = useFarm()
  const { role, canManage } = usePermissions()
  const users = useUsers(canManage)

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <p className="eyebrow">Configuration</p>
        <h1 className="text-xl font-semibold tracking-tight text-ink">Settings</h1>
      </div>

      <Card>
        <CardHeader>
          <h2 className="text-sm font-medium text-ink">Farm</h2>
        </CardHeader>
        <CardBody>
          {farm.isPending ? (
            <div className="h-16 animate-pulse rounded-control bg-raised" />
          ) : farm.isError ? (
            <p className="text-sm text-alert">{farm.error.message}</p>
          ) : (
            <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3 lg:grid-cols-5">
              <Fact label="Name">{farm.data.name}</Fact>
              {/* Platform-locked to NGN. The column exists so per-farm currency
                  is a later upgrade rather than a migration. */}
              <Fact label="Currency">
                <span className="figure">{farm.data.currency_code}</span>
              </Fact>
              <Fact label="Timezone">{farm.data.timezone}</Fact>
              <Fact label="Hogs">
                <span className="figure">{formatInteger(farm.data.hog_count)}</span>
              </Fact>
              <Fact label="Your role">{role ? ROLE_LABELS[role] : '—'}</Fact>
            </dl>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-sm font-medium text-ink">Staff</h2>
          {canManage && users.data ? (
            <p className="text-xs text-muted">
              <span className="figure text-ink">{formatInteger(users.data.total)}</span> on this
              farm
            </p>
          ) : null}
        </CardHeader>
        <CardBody>
          {!canManage ? (
            <p className="text-sm text-muted">
              The staff roster is visible to managers and admins only.
            </p>
          ) : users.isPending ? (
            <div className="h-24 animate-pulse rounded-control bg-raised" />
          ) : users.isError ? (
            <p className="text-sm text-alert">{users.error.message}</p>
          ) : (
            <ul className="divide-y divide-rule/60">
              {users.data.items.map((user) => (
                <li key={user.id} className="flex items-center justify-between gap-4 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm text-ink">{user.full_name}</p>
                    <p className="truncate text-xs text-muted">{user.email}</p>
                  </div>
                  <span
                    className={cn(
                      'shrink-0 rounded-sm px-1.5 py-0.5 text-[0.6875rem] font-medium',
                      user.role === 'viewer' ? 'bg-raised text-muted' : 'bg-ochre/15 text-ochre',
                    )}
                  >
                    {ROLE_LABELS[user.role]}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardBody className="space-y-1">
          <p className="text-sm text-ink">Nothing here is editable</p>
          <p className="text-xs text-muted">
            The API has no update route for the farm record, and staff accounts are created through
            registration rather than in-app. Both are deliberate for a local-first deployment; a
            farm that needs either changed edits the database directly.
          </p>
        </CardBody>
      </Card>
    </div>
  )
}
