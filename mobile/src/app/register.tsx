import { useRouter } from 'expo-router'
import { useState } from 'react'
import { StyleSheet, View } from 'react-native'

import { api } from '@/api-runtime'
import { useAuth } from '@/components/auth-provider'
import { Button } from '@/components/ui/button'
import { Banner } from '@/components/ui/feedback'
import { Field, Input } from '@/components/ui/field'
import { Screen, ScreenHeader } from '@/components/ui/screen'
import { errorMessage } from '@/lib/api/errors'
import { space } from '@/theme/tokens'

/** Mirrors `UserRegister` in `backend/app/schemas/user.py`. */
function passwordProblem(password: string): string | null {
  if (password.length < 8) return 'Use at least 8 characters.'
  if (password.length > 128) return 'Use 128 characters or fewer.'
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    return 'Include at least one letter and one number.'
  }
  return null
}

/**
 * Creates a farm and its first manager.
 *
 * Rare on a phone — a farm is usually set up at a desk — but the app cannot
 * assume an account already exists, and pointing someone at a laptop to get
 * started is a worse first run than one extra screen.
 */
export default function Register() {
  const router = useRouter()
  const { signIn } = useAuth()

  const [fullName, setFullName] = useState('')
  const [farmName, setFarmName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [touchedPassword, setTouchedPassword] = useState(false)

  const passwordError = touchedPassword ? passwordProblem(password) : null
  const complete = fullName.trim() && farmName.trim() && email.trim() && password

  async function submit() {
    // Checked here as well as on blur: the server's 422 for a weak password is
    // technically accurate and completely unreadable.
    const problem = passwordProblem(password)
    if (problem) {
      setTouchedPassword(true)
      return
    }

    setBusy(true)
    setError(null)
    try {
      await api.register({
        email: email.trim(),
        password,
        full_name: fullName.trim(),
        farm_name: farmName.trim(),
      })
      await signIn(email.trim(), password)
      router.replace('/today')
    } catch (cause) {
      setError(errorMessage(cause))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Screen>
      <ScreenHeader section="Get started" title="Create a farm" />

      <View style={styles.form}>
        {error ? <Banner tone="alert" message={error} /> : null}

        <Field label="Your name">
          <Input value={fullName} onChangeText={setFullName} autoComplete="name" />
        </Field>

        <Field label="Farm name">
          <Input value={farmName} onChangeText={setFarmName} />
        </Field>

        <Field label="Email">
          <Input
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            autoComplete="email"
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
            onBlur={() => setTouchedPassword(true)}
            secureTextEntry
            autoCapitalize="none"
            invalid={passwordError !== null}
          />
        </Field>

        <Button
          label={error ? 'Try again' : 'Create farm'}
          size="lg"
          fullWidth
          loading={busy}
          disabled={!complete}
          onPress={submit}
        />

        <Button label="Back to sign in" variant="ghost" onPress={() => router.back()} />
      </View>
    </Screen>
  )
}

const styles = StyleSheet.create({
  form: { gap: space.lg },
})
