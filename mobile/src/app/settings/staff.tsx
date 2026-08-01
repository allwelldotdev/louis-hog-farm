import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'

import { api } from '@/api-runtime'
import { Button } from '@/components/ui/button'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { Banner, EmptyState, Skeleton } from '@/components/ui/feedback'
import { Field, Input } from '@/components/ui/field'
import { LockedNotice } from '@/components/ui/locked'
import { Pill, roleTone } from '@/components/ui/pill'
import { Screen, ScreenHeader } from '@/components/ui/screen'
import { SegmentedChips } from '@/components/ui/segmented-chips'
import { useCurrentUser, usePermissions } from '@/hooks/use-farm'
import { useFarmMutation } from '@/hooks/use-farm-mutation'
import { errorMessage } from '@/lib/api/errors'
import type { UserRead, UserRole } from '@/lib/api/types'
import { ROLE_LABELS, STAFF_ROLES, canChangeRoleOf } from '@/lib/auth/permissions'
import { queryKeys } from '@/lib/query/keys'
import { useColors } from '@/theme/theme-provider'
import { space } from '@/theme/tokens'
import { text } from '@/theme/type'

type StaffRole = (typeof STAFF_ROLES)[number]

/** Mirrors `UserCreateStaff` in `backend/app/schemas/user.py`. */
function passwordProblem(password: string): string | null {
  if (password.length < 8) return 'Use at least 8 characters.'
  if (password.length > 128) return 'Use 128 characters or fewer.'
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    return 'Include at least one letter and one number.'
  }
  return null
}

/**
 * Staff — **the one locked read in the app.**
 *
 * Everywhere else the data is open and only the write locks, which is what
 * makes present-but-locked coherent: a locked screen is still a useful screen.
 * `GET /users` is manager-gated, so there is genuinely nothing to show a
 * worker here. Say so plainly rather than render an empty list, which would
 * look like a farm with no staff.
 */
export default function Staff() {
  const { canManage, isPending } = usePermissions()

  if (isPending) {
    return (
      <Screen>
        <ScreenHeader section="Farm" title="Staff" />
        <Skeleton height={96} />
      </Screen>
    )
  }

  if (!canManage) {
    return (
      <Screen>
        <ScreenHeader section="Farm" title="Staff" />
        <LockedNotice role="manager" can="staff accounts are managed by your farm's manager" />
      </Screen>
    )
  }

  return <StaffRoster />
}

function StaffRoster() {
  const me = useCurrentUser()
  const { data, isPending, error } = useQuery({
    queryKey: queryKeys.list('users'),
    queryFn: () => api.get<UserRead[]>('/users'),
  })

  return (
    <Screen>
      <ScreenHeader section="Farm" title="Staff" />
      <AddStaff />

      <Card>
        <CardHeader title="Accounts" hint={data ? `${data.length} on this farm` : undefined} />
        <CardBody>
          {isPending ? (
            <Skeleton height={72} />
          ) : error ? (
            <Banner tone="alert" message={errorMessage(error)} />
          ) : (data?.length ?? 0) === 0 ? (
            <EmptyState message="No accounts yet." />
          ) : (
            <View style={styles.stack}>
              {data?.map((user) => (
                <StaffRow key={user.id} user={user} currentUserId={me.data?.id} />
              ))}
            </View>
          )}
        </CardBody>
      </Card>
    </Screen>
  )
}

function StaffRow({ user, currentUserId }: { user: UserRead; currentUserId: number | undefined }) {
  const colors = useColors()
  const [error, setError] = useState<string | null>(null)

  const mutation = useFarmMutation((role: UserRole) =>
    api.mutate('PATCH', `/users/${user.id}`, { role }),
  )

  // Never your own row, never another manager's — mirrors the two guards on
  // PATCH /users/{id}. Nothing in the app can promote anyone back to manager,
  // so a demotion would be a one-way door.
  const editable = canChangeRoleOf(user, currentUserId)

  return (
    <View style={[styles.row, { borderTopColor: colors.rule }]}>
      <View style={styles.rowText}>
        <Text style={[text.bodyMedium, { color: colors.ink }]}>{user.full_name}</Text>
        <Text style={[text.meta, { color: colors.muted }]} numberOfLines={1}>
          {user.email}
        </Text>
      </View>

      {editable ? (
        <View style={styles.stackSm}>
          {error ? <Banner tone="alert" message={error} /> : null}
          <SegmentedChips<StaffRole>
            options={STAFF_ROLES.map((value) => ({ value, label: ROLE_LABELS[value] }))}
            value={user.role === 'worker' || user.role === 'viewer' ? user.role : undefined}
            onChange={(role) => {
              if (!role) return
              setError(null)
              mutation.mutateAsync(role).catch((cause) => setError(errorMessage(cause)))
            }}
          />
        </View>
      ) : (
        <Pill label={ROLE_LABELS[user.role]} tone={roleTone(user.role)} />
      )}
    </View>
  )
}

function AddStaff() {
  const [open, setOpen] = useState(false)
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<StaffRole | undefined>('worker')
  const [touched, setTouched] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [added, setAdded] = useState<string | null>(null)

  const mutation = useFarmMutation((body: Record<string, unknown>) =>
    api.mutate<UserRead>('POST', '/users', body),
  )

  const passwordError = touched ? passwordProblem(password) : null
  const complete = Boolean(fullName.trim() && email.trim() && password && role)

  async function submit() {
    // Checked here as well as on blur: the server's 422 for a weak password is
    // accurate and completely unreadable.
    if (passwordProblem(password)) {
      setTouched(true)
      return
    }
    setError(null)
    try {
      await mutation.mutateAsync({
        full_name: fullName.trim(),
        email: email.trim(),
        password,
        role,
      })
      setAdded(fullName.trim())
      setFullName('')
      setEmail('')
      setPassword('')
      setTouched(false)
      setOpen(false)
    } catch (cause) {
      setError(errorMessage(cause))
    }
  }

  if (!open) {
    return (
      <View style={styles.stack}>
        {added ? <Banner tone="gain" message={`${added} can now sign in.`} /> : null}
        <Button label="Add a person" variant="outline" fullWidth onPress={() => setOpen(true)} />
      </View>
    )
  }

  return (
    <Card>
      <CardHeader title="Add a person" hint="They sign in with this email" />
      <CardBody>
        <View style={styles.stack}>
          {error ? <Banner tone="alert" message={error} /> : null}

          <Field label="Name">
            <Input value={fullName} onChangeText={setFullName} autoComplete="name" />
          </Field>

          <Field label="Email">
            <Input
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
            />
          </Field>

          <Field
            label="Password"
            error={passwordError ?? undefined}
            hint="At least 8 characters, with a letter and a number."
          >
            <Input
              value={password}
              onChangeText={setPassword}
              onBlur={() => setTouched(true)}
              secureTextEntry
              autoCapitalize="none"
              invalid={passwordError !== null}
            />
          </Field>

          <Field label="Role" hint="A manager can only create workers and viewers.">
            <SegmentedChips<StaffRole>
              options={STAFF_ROLES.map((value) => ({ value, label: ROLE_LABELS[value] }))}
              value={role}
              onChange={setRole}
            />
          </Field>

          <Button
            label={error ? 'Try again' : 'Create account'}
            size="lg"
            fullWidth
            disabled={!complete}
            loading={mutation.isPending}
            onPress={submit}
          />
          <Button label="Cancel" variant="ghost" onPress={() => setOpen(false)} />
        </View>
      </CardBody>
    </Card>
  )
}

const styles = StyleSheet.create({
  stack: { gap: space.lg },
  stackSm: { gap: space.sm },
  row: { borderTopWidth: 1, paddingTop: space.md, gap: space.sm },
  rowText: { gap: 2 },
})
