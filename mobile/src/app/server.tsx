import { useRouter } from 'expo-router'
import { useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'

import { defaultBaseUrl, getBaseUrl, setBaseUrlOverride } from '@/api-runtime'
import { useAuth } from '@/components/auth-provider'
import { Button } from '@/components/ui/button'
import { Banner } from '@/components/ui/feedback'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { Field, Input } from '@/components/ui/field'
import { Screen, ScreenHeader } from '@/components/ui/screen'
import { normaliseBase } from '@/lib/api/base-url'
import { useColors } from '@/theme/theme-provider'
import { space } from '@/theme/tokens'
import { text } from '@/theme/type'

type Probe = { ok: boolean; message: string } | null

/**
 * The server address, editable on the device.
 *
 * Reachable from sign-in and from Settings. Changing it signs the user out:
 * every cached figure was true of the old server and is a lie about the new
 * one, and the token was issued by a database that may not have this account.
 */
export default function ServerAddress() {
  const colors = useColors()
  const router = useRouter()
  const { signOut } = useAuth()

  const [value, setValue] = useState(getBaseUrl() ?? '')
  const [probe, setProbe] = useState<Probe>(null)
  const [busy, setBusy] = useState(false)

  const fallback = defaultBaseUrl()
  const normalised = normaliseBase(value)

  async function test() {
    if (!normalised) {
      setProbe({ ok: false, message: 'That is not a valid http:// or https:// address.' })
      return
    }
    setBusy(true)
    setProbe(null)
    try {
      // `/health` is liveness only and needs no token, so this is a clean test
      // of reachability rather than of credentials.
      const response = await fetch(`${normalised}/health`)
      setProbe(
        response.ok
          ? { ok: true, message: `Reached the farm server at ${normalised}.` }
          : { ok: false, message: `The server answered ${response.status}.` },
      )
    } catch {
      setProbe({
        ok: false,
        message: 'No answer. Check the phone and the server are on the same wifi.',
      })
    } finally {
      setBusy(false)
    }
  }

  async function save() {
    if (!normalised) {
      setProbe({ ok: false, message: 'That is not a valid http:// or https:// address.' })
      return
    }
    setBusy(true)
    await setBaseUrlOverride(normalised)
    await signOut()
    setBusy(false)
    router.replace('/sign-in')
  }

  async function reset() {
    setBusy(true)
    const resolved = await setBaseUrlOverride(null)
    setValue(resolved ?? '')
    await signOut()
    setBusy(false)
    router.replace('/sign-in')
  }

  return (
    <Screen>
      <ScreenHeader section="Connection" title="Server address" />

      <Card>
        <CardHeader title="Where the farm data lives" />
        <CardBody>
          <View style={styles.stack}>
            {probe ? <Banner tone={probe.ok ? 'gain' : 'alert'} message={probe.message} /> : null}

            <Field
              label="Address"
              hint="The computer running the farm server, e.g. http://192.168.1.20:8000"
            >
              <Input
                value={value}
                onChangeText={setValue}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                placeholder="http://192.168.1.20:8000"
              />
            </Field>

            <Button label="Test connection" variant="outline" loading={busy} onPress={test} />
            <Button label="Save and sign out" size="lg" fullWidth disabled={busy} onPress={save} />
          </View>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Automatic" hint="Used when no address is set here" />
        <CardBody>
          <View style={styles.stack}>
            <Text style={[text.meta, { color: colors.muted }]}>
              {fallback
                ? `Without an address of its own, the app uses ${fallback} — the computer it loaded from.`
                : 'No automatic address is available. Enter one above.'}
            </Text>
            <Button
              label="Use the automatic address"
              variant="ghost"
              disabled={busy}
              onPress={reset}
            />
          </View>
        </CardBody>
      </Card>

      <Button label="Back" variant="ghost" onPress={() => router.back()} />
    </Screen>
  )
}

const styles = StyleSheet.create({
  stack: { gap: space.lg },
})
