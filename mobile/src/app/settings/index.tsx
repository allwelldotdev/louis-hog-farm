import { useRouter } from 'expo-router'
import { useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'

import { api } from '@/api-runtime'
import { useAuth } from '@/components/auth-provider'
import { Button } from '@/components/ui/button'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { Banner } from '@/components/ui/feedback'
import { Field, Input } from '@/components/ui/field'
import { Locked } from '@/components/ui/locked'
import { Pill, roleTone } from '@/components/ui/pill'
import { Screen, ScreenHeader } from '@/components/ui/screen'
import { SegmentedChips } from '@/components/ui/segmented-chips'
import { useCurrentUser, useFarm, usePermissions } from '@/hooks/use-farm'
import { useFarmMutation } from '@/hooks/use-farm-mutation'
import { errorMessage } from '@/lib/api/errors'
import { ROLE_LABELS } from '@/lib/auth/permissions'
import { getBaseUrl } from '@/api-runtime'
import { THEME_LABELS, type ThemePreference } from '@/theme/preference'
import { useColors, useTheme } from '@/theme/theme-provider'
import { space } from '@/theme/tokens'
import { eyebrow, text } from '@/theme/type'

const THEME_OPTIONS: ThemePreference[] = ['system', 'light', 'dark']

export default function Settings() {
  const colors = useColors()
  const router = useRouter()
  const { preference, setTheme } = useTheme()
  const { signOut } = useAuth()
  const user = useCurrentUser()
  const farm = useFarm()
  const { canManage } = usePermissions()

  return (
    <Screen>
      <ScreenHeader section="Account" title="Settings" />

      <Card>
        <CardHeader title="You" />
        <CardBody>
          <View style={styles.stack}>
            <Row label="Name" value={user.data?.full_name ?? '—'} />
            <Row label="Email" value={user.data?.email ?? '—'} />
            <View style={styles.roleRow}>
              <Text style={[eyebrow, { color: colors.muted }]}>Role</Text>
              {user.data ? (
                <Pill label={ROLE_LABELS[user.data.role]} tone={roleTone(user.data.role)} />
              ) : null}
            </View>
          </View>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Appearance" />
        <CardBody>
          {/*
            Three chips rather than the dashboard's cycling icon button: a phone
            has no hover title, so a lone icon is a guess about what happens
            next. The contract behind it is identical — `system` is stored as
            the absence of the key.
          */}
          <SegmentedChips
            options={THEME_OPTIONS.map((value) => ({ value, label: THEME_LABELS[value] }))}
            value={preference}
            onChange={(value) => setTheme(value ?? 'system')}
          />
        </CardBody>
      </Card>

      <FarmCard canManage={canManage} />

      <Card>
        <CardHeader title="Farm settings" hint="Fixed per deployment" />
        <CardBody>
          <View style={styles.stack}>
            <Row label="Currency" value={farm.data?.currency_code ?? '—'} />
            <Row label="Timezone" value={farm.data?.timezone ?? '—'} />
            <Text style={[text.meta, { color: colors.muted }]}>
              {/* Feed records store their currency at write time, so changing it
                  retroactively would leave the money charts summing two units. */}
              Neither can be changed from the app. Feed records keep the currency they were entered
              in.
            </Text>
          </View>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Connection" />
        <CardBody>
          <View style={styles.stack}>
            <Row label="Server" value={getBaseUrl() ?? 'Not configured'} />
            <Button
              label="Change server address"
              variant="outline"
              onPress={() => router.push('/server')}
            />
          </View>
        </CardBody>
      </Card>

      <Button
        label="Sign out"
        variant="outline"
        fullWidth
        onPress={() => {
          void signOut().then(() => router.replace('/sign-in'))
        }}
      />
    </Screen>
  )
}

/** `PATCH /farms/me` takes the name and nothing else, and is manager-gated. */
function FarmCard({ canManage }: { canManage: boolean }) {
  const farm = useFarm()
  const [name, setName] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const mutation = useFarmMutation((body: { name: string }) =>
    api.mutate('PATCH', '/farms/me', body),
  )

  const value = name ?? farm.data?.name ?? ''
  const dirty = farm.data ? value.trim() !== farm.data.name && value.trim().length > 0 : false

  async function save() {
    setError(null)
    setSaved(false)
    try {
      await mutation.mutateAsync({ name: value.trim() })
      setName(null)
      setSaved(true)
    } catch (cause) {
      setError(errorMessage(cause))
    }
  }

  return (
    <Card>
      <CardHeader title="Farm" />
      <CardBody>
        <Locked when={!canManage} role="manager" can="you can see the farm name but not change it">
          <View style={styles.stack}>
            {error ? <Banner tone="alert" message={error} /> : null}
            {saved ? <Banner tone="gain" message="Farm name updated." /> : null}
            <Field label="Name">
              <Input value={value} onChangeText={setName} placeholder="Farm name" />
            </Field>
            <Button
              label={error ? 'Try again' : 'Save name'}
              disabled={!dirty}
              loading={mutation.isPending}
              onPress={save}
            />
          </View>
        </Locked>
      </CardBody>
    </Card>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  const colors = useColors()
  return (
    <View style={styles.row}>
      <Text style={[eyebrow, { color: colors.muted }]}>{label}</Text>
      <Text style={[text.body, { color: colors.ink }]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  stack: { gap: space.lg },
  row: { gap: 2 },
  roleRow: { gap: space.sm, alignItems: 'flex-start' },
})
