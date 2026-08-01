import { Link, useRouter } from 'expo-router'
import { useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'

import { getBaseUrl } from '@/api-runtime'
import { useAuth } from '@/components/auth-provider'
import { Button } from '@/components/ui/button'
import { Banner } from '@/components/ui/feedback'
import { Field, Input } from '@/components/ui/field'
import { Screen } from '@/components/ui/screen'
import { errorMessage } from '@/lib/api/errors'
import { useColors } from '@/theme/theme-provider'
import { space } from '@/theme/tokens'
import { eyebrow, text } from '@/theme/type'

export default function SignIn() {
  const colors = useColors()
  const router = useRouter()
  const { signIn } = useAuth()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const base = getBaseUrl()

  async function submit() {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      await signIn(email.trim(), password)
      router.replace('/today')
    } catch (cause) {
      // `errorMessage` already rewrites the lockout 403 into something
      // actionable — a permissions message here would be nonsense.
      setError(errorMessage(cause))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Screen contentStyle={styles.content}>
      <View style={styles.brand}>
        {/* The dashboard wordmark's ochre underline, reused. */}
        <View style={[styles.mark, { backgroundColor: colors.ochre }]} />
        <Text style={[text.h1, { color: colors.ink }]}>Bright Acres</Text>
        <Text style={[text.meta, { color: colors.muted }]}>Record what happens in the pens.</Text>
      </View>

      <View style={styles.form}>
        {error ? <Banner tone="alert" message={error} /> : null}

        <Field label="Email">
          <Input
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            keyboardType="email-address"
            placeholder="you@farm.com"
            returnKeyType="next"
          />
        </Field>

        <Field label="Password">
          <Input
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            autoComplete="password"
            returnKeyType="go"
            onSubmitEditing={submit}
          />
        </Field>

        <Button
          label={error ? 'Try again' : 'Sign in'}
          size="lg"
          fullWidth
          loading={busy}
          disabled={!email.trim() || !password}
          onPress={submit}
        />

        <Link href="/register" style={styles.link}>
          <Text style={[text.meta, { color: colors.ochre }]}>Create a farm</Text>
        </Link>
      </View>

      {/*
        Showing the resolved server address here is the difference between "it
        doesn't work" and "it's pointing at the wrong laptop" — by far the most
        common way a fresh setup fails, and invisible without this row.
      */}
      <View style={[styles.server, { borderTopColor: colors.rule }]}>
        <View style={styles.serverText}>
          <Text style={[eyebrow, { color: colors.muted }]}>Server</Text>
          <Text style={[text.meta, { color: base ? colors.ink : colors.alert }]} numberOfLines={1}>
            {base ?? 'Not configured'}
          </Text>
        </View>
        <Button label="Change" variant="outline" size="sm" onPress={() => router.push('/server')} />
      </View>
    </Screen>
  )
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, justifyContent: 'center', gap: space.xxl },
  brand: { gap: space.sm },
  mark: { height: 2, width: 32, borderRadius: 999, marginBottom: space.sm },
  form: { gap: space.lg },
  link: { alignSelf: 'center', paddingVertical: space.md },
  server: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    borderTopWidth: 1,
    paddingTop: space.lg,
  },
  serverText: { flex: 1, gap: 2 },
})
