'use client'

import { Pencil, Plus } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { FarmForm } from '@/components/settings/farm-form'
import { StaffForm } from '@/components/settings/staff-form'
import { Button } from '@/components/ui/button'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { Select } from '@/components/ui/field'
import { useCurrentUser, usePermissions } from '@/hooks/use-current-user'
import { useFarm } from '@/hooks/use-farm'
import { useUpdateUserRole, useUsers } from '@/hooks/use-users'
import { ApiError } from '@/lib/api/client'
import type { UserRole } from '@/lib/api/types'
import { ROLE_LABELS, STAFF_ROLES, canChangeRoleOf } from '@/lib/auth/permissions'
import { formatInteger } from '@/lib/format'
import { cn } from '@/lib/utils'

/**
 * What a manager can change about the farm itself and the people on it.
 *
 * Three things stay fixed and say so rather than offering a control that cannot
 * work: currency and timezone are per-deployment, and a manager's own role —
 * and any other manager's — cannot be changed, because nothing in the app can
 * promote anyone back to manager. Both rules mirror the API exactly, so nothing
 * here renders an affordance that could only answer 400 or 403.
 */

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="eyebrow">{label}</dt>
      <dd className="mt-1 text-sm text-ink">{children}</dd>
    </div>
  )
}

function RoleBadge({ role }: { role: UserRole }) {
  return (
    <span
      className={cn(
        'shrink-0 rounded-sm px-1.5 py-0.5 text-[0.6875rem] font-medium',
        role === 'viewer' ? 'bg-raised text-muted' : 'bg-ochre/15 text-ochre',
      )}
    >
      {ROLE_LABELS[role]}
    </span>
  )
}

export function SettingsView() {
  const farm = useFarm()
  const { role, canManage } = usePermissions()
  const { data: me } = useCurrentUser()
  const users = useUsers(canManage)
  const updateRole = useUpdateUserRole()
  const [isFarmFormOpen, setFarmFormOpen] = useState(false)
  const [isStaffFormOpen, setStaffFormOpen] = useState(false)

  async function changeRole(id: number, next: UserRole) {
    try {
      await updateRole.mutateAsync({ id, role: next })
      toast.success(`Role changed to ${ROLE_LABELS[next].toLowerCase()}`)
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Could not change the role.')
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <p className="eyebrow">Configuration</p>
        <h1 className="text-xl font-semibold tracking-tight text-ink">Settings</h1>
      </div>

      <Card>
        <CardHeader>
          <h2 className="text-sm font-medium text-ink">Farm</h2>
          {canManage && farm.data ? (
            <Button variant="outline" size="sm" onClick={() => setFarmFormOpen(true)}>
              <Pencil aria-hidden />
              Rename
            </Button>
          ) : null}
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
          <div className="flex items-center gap-3">
            {canManage && users.data ? (
              <p className="text-xs text-muted">
                <span className="figure text-ink">{formatInteger(users.data.total)}</span> on this
                farm
              </p>
            ) : null}
            {canManage ? (
              <Button variant="outline" size="sm" onClick={() => setStaffFormOpen(true)}>
                <Plus aria-hidden />
                Add staff
              </Button>
            ) : null}
          </div>
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
                    <p className="truncate text-sm text-ink">
                      {user.full_name}
                      {user.id === me?.id ? (
                        <span className="ml-2 text-xs text-muted">you</span>
                      ) : null}
                    </p>
                    <p className="truncate text-xs text-muted">{user.email}</p>
                  </div>

                  {/* A control only where the API would accept the change; a
                      badge everywhere else, so the roster never offers a select
                      that can only answer 400 or 403. */}
                  {canChangeRoleOf(user, me?.id) ? (
                    <Select
                      aria-label={`Role for ${user.full_name}`}
                      className="h-8 shrink-0"
                      value={user.role}
                      disabled={updateRole.isPending}
                      onChange={(event) => void changeRole(user.id, event.target.value as UserRole)}
                    >
                      {STAFF_ROLES.map((value) => (
                        <option key={value} value={value}>
                          {ROLE_LABELS[value]}
                        </option>
                      ))}
                    </Select>
                  ) : (
                    <RoleBadge role={user.role} />
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      {/* Stated rather than left to be discovered by trying: these are the two
          things on this page a manager cannot change, and why. */}
      <Card>
        <CardBody className="space-y-1">
          <p className="text-sm text-ink">What stays fixed</p>
          <p className="text-xs text-muted">
            Currency and timezone are set per deployment — Nigerian farms run on NGN and
            Africa/Lagos, and feed records store the currency at the moment they are written, so
            changing it later would leave the money charts summing two units. Manager accounts are
            not created or demoted from here either: nothing in the app can promote anyone back to
            manager, so a demotion would lock the farm out of this page.
          </p>
        </CardBody>
      </Card>

      {canManage ? (
        <>
          {farm.data ? (
            <FarmForm
              open={isFarmFormOpen}
              onClose={() => setFarmFormOpen(false)}
              name={farm.data.name}
            />
          ) : null}
          <StaffForm open={isStaffFormOpen} onClose={() => setStaffFormOpen(false)} />
        </>
      ) : null}
    </div>
  )
}
