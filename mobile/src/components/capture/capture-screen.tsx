import * as Haptics from 'expo-haptics'
import { useRouter } from 'expo-router'
import { CheckCircle2 } from 'lucide-react-native'
import { useState, type ReactNode } from 'react'
import { StyleSheet, Text, View } from 'react-native'

import { Button } from '@/components/ui/button'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { Banner } from '@/components/ui/feedback'
import { Screen, ScreenHeader } from '@/components/ui/screen'
import { useColors } from '@/theme/theme-provider'
import { space } from '@/theme/tokens'
import { text } from '@/theme/type'

/**
 * The shape every capture flow wears.
 *
 * Two decisions live here rather than in each form.
 *
 * **A failed submit never unmounts the form.** No navigation, no reset: a
 * banner appears, the button relabels to "Try again", and every typed value
 * stays exactly where it was. This is the whole of the online-only contract
 * from the user's side — the app cannot queue the write, so the least it can
 * do is not lose it. Retyping a weight while holding a pig is the failure this
 * exists to prevent.
 *
 * **Success is a confirmation, not a dismissal.** It replaces the form with
 * what was recorded plus "Record another" and "Done". Weighing a pen of twenty
 * then becomes a two-tap-and-a-number loop rather than twenty trips back
 * through the menu.
 */
export function CaptureScreen({
  section,
  title,
  submitLabel,
  children,
  onSubmit,
  canSubmit,
  success,
  onAnother,
  note,
}: {
  section: string
  title: string
  submitLabel: string
  children: ReactNode
  onSubmit: () => Promise<void>
  canSubmit: boolean
  /** Rendered instead of the form once the write lands. */
  success: string | null
  onAnother: () => void
  /** A standing caveat, e.g. that vaccinations cannot be edited. */
  note?: string
}) {
  const colors = useColors()
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      await onSubmit()
      // In a noisy barn, with the phone at arm's length, a haptic is the only
      // confirmation that reliably lands. It is also the entire animation
      // budget for this screen.
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    } catch (cause) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      setError(cause instanceof Error ? cause.message : 'Could not save. Try again.')
    } finally {
      setBusy(false)
    }
  }

  if (success) {
    return (
      <Screen>
        <ScreenHeader section={section} title="Recorded" />
        <Card>
          <CardHeader title="Saved" />
          <CardBody>
            <View style={styles.success}>
              <CheckCircle2 size={28} color={colors.gain} />
              <Text style={[text.body, { color: colors.ink }]}>{success}</Text>
              {note ? <Text style={[text.meta, { color: colors.muted }]}>{note}</Text> : null}
            </View>
          </CardBody>
        </Card>
        <Button label="Record another" size="lg" fullWidth onPress={onAnother} />
        <Button label="Done" variant="outline" onPress={() => router.dismissAll()} />
      </Screen>
    )
  }

  return (
    <Screen>
      <ScreenHeader section={section} title={title} />

      {error ? <Banner tone="alert" message={error} /> : null}

      <View style={styles.form}>{children}</View>

      {note ? <Text style={[text.meta, { color: colors.muted }]}>{note}</Text> : null}

      <Button
        label={error ? 'Try again' : submitLabel}
        size="lg"
        fullWidth
        loading={busy}
        disabled={!canSubmit}
        onPress={submit}
      />
      <Button label="Cancel" variant="ghost" onPress={() => router.back()} />
    </Screen>
  )
}

const styles = StyleSheet.create({
  form: { gap: space.xl },
  success: { alignItems: 'center', gap: space.md, paddingVertical: space.md },
})
