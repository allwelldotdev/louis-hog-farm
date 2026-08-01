import { useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'

import { api, getBaseUrl } from '@/api-runtime'
import { Button } from '@/components/ui/button'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { Banner } from '@/components/ui/feedback'
import { Field, Input } from '@/components/ui/field'
import { Pill, roleTone } from '@/components/ui/pill'
import { Screen, ScreenHeader } from '@/components/ui/screen'
import { errorMessage } from '@/lib/api/errors'
import { ROLE_LABELS } from '@/lib/auth/permissions'
import { formatInteger, formatNumber } from '@/lib/format'
import { useCurrentUser, useFarm, useKpis } from '@/hooks/use-farm'
import { useTheme } from '@/theme/theme-provider'
import { space } from '@/theme/tokens'
import { eyebrow, figure, figureSize, text } from '@/theme/type'

/**
 * Temporary connectivity check — replaced by the boot route in P3.
 *
 * Exists so the data layer is *proven* against the seeded database from a real
 * device rather than asserted from unit tests: sign in, then read `/users/me`,
 * `/farms/me` and `/dashboard/kpis` through the same client, cache and bearer
 * path every screen will use.
 */
export default function ConnectivityCheck() {
  const { colors } = useTheme()
  const [email, setEmail] = useState('manager@brightacres.com')
  const [password, setPassword] = useState('')
  const [signedIn, setSignedIn] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function signIn() {
    setBusy(true)
    setError(null)
    try {
      await api.login(email.trim(), password)
      setSignedIn(true)
    } catch (cause) {
      setError(errorMessage(cause))
    } finally {
      setBusy(false)
    }
  }

  async function signOut() {
    await api.signOut()
    setSignedIn(false)
  }

  return (
    <Screen>
      <ScreenHeader section="P2 check" title="Data layer" />

      <Card>
        <CardHeader title="Server" hint="Resolved at boot" />
        <CardBody>
          <Text style={[text.body, { color: colors.ink }]}>{getBaseUrl() ?? 'not configured'}</Text>
        </CardBody>
      </Card>

      {signedIn ? (
        <>
          <SessionCards />
          <Button label="Sign out" variant="outline" onPress={signOut} />
        </>
      ) : (
        <Card>
          <CardHeader title="Sign in" />
          <CardBody>
            <View style={styles.stack}>
              {error ? <Banner tone="alert" message={error} /> : null}
              <Field label="Email">
                <Input
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                />
              </Field>
              <Field label="Password">
                <Input value={password} onChangeText={setPassword} secureTextEntry />
              </Field>
              <Button
                label={error ? 'Try again' : 'Sign in'}
                size="lg"
                fullWidth
                loading={busy}
                onPress={signIn}
              />
            </View>
          </CardBody>
        </Card>
      )}
    </Screen>
  )
}

function SessionCards() {
  const { colors } = useTheme()
  const user = useCurrentUser()
  const farm = useFarm()
  const kpis = useKpis()

  return (
    <>
      <Card>
        <CardHeader title="GET /users/me" />
        <CardBody>
          {user.isPending ? (
            <Text style={[text.meta, { color: colors.muted }]}>Loading…</Text>
          ) : user.error ? (
            <Banner tone="alert" message={errorMessage(user.error)} />
          ) : user.data ? (
            <View style={styles.stack}>
              <Text style={[text.bodyMedium, { color: colors.ink }]}>{user.data.full_name}</Text>
              <Text style={[text.meta, { color: colors.muted }]}>{user.data.email}</Text>
              <Pill label={ROLE_LABELS[user.data.role]} tone={roleTone(user.data.role)} />
            </View>
          ) : null}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="GET /farms/me" />
        <CardBody>
          {farm.data ? (
            <View style={styles.stack}>
              <Text style={[text.bodyMedium, { color: colors.ink }]}>{farm.data.name}</Text>
              <Text style={[text.meta, { color: colors.muted }]}>
                {farm.data.hog_count} active · {farm.data.currency_code} · {farm.data.timezone}
              </Text>
            </View>
          ) : (
            <Text style={[text.meta, { color: colors.muted }]}>
              {farm.error ? errorMessage(farm.error) : 'Loading…'}
            </Text>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="GET /dashboard/kpis" hint="Also the source of farm-today" />
        <CardBody>
          {kpis.data ? (
            <View style={styles.row}>
              <Metric label="Active hogs" value={formatInteger(kpis.data.active_hogs_count)} />
              <Metric label="Avg daily gain" value={formatNumber(kpis.data.avg_daily_gain_kg)} />
              <Metric label="Farm today" value={kpis.data.date_to} small />
            </View>
          ) : (
            <Text style={[text.meta, { color: colors.muted }]}>
              {kpis.error ? errorMessage(kpis.error) : 'Loading…'}
            </Text>
          )}
        </CardBody>
      </Card>
    </>
  )
}

function Metric({ label, value, small }: { label: string; value: string; small?: boolean }) {
  const { colors } = useTheme()
  return (
    <View style={styles.metric}>
      <Text style={[eyebrow, { color: colors.muted }]}>{label}</Text>
      <Text style={[figure(small ? figureSize.sm : figureSize.md), { color: colors.ink }]}>
        {value}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  stack: { gap: space.md },
  row: { flexDirection: 'row', gap: space.md, flexWrap: 'wrap' },
  metric: { flex: 1, minWidth: 100, gap: 4 },
})
