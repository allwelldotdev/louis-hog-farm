import { zodResolver } from '@hookform/resolvers/zod'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useState } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { StyleSheet, Text, View } from 'react-native'
import { z } from 'zod'

import { api } from '@/api-runtime'
import { CaptureScreen } from '@/components/capture/capture-screen'
import { DateField } from '@/components/capture/date-field'
import { applyFieldErrors } from '@/components/capture/field-errors'
import { Button } from '@/components/ui/button'
import { Banner } from '@/components/ui/feedback'
import { Field, Input } from '@/components/ui/field'
import { useFarmToday } from '@/hooks/use-farm'
import { useFarmMutation } from '@/hooks/use-farm-mutation'
import { useHog } from '@/hooks/use-hogs'
import { errorMessage } from '@/lib/api/errors'
import type { MortalityEvent } from '@/lib/api/types'
import { useColors } from '@/theme/theme-provider'
import { space } from '@/theme/tokens'
import { text } from '@/theme/type'

const schema = z.object({
  cause: z.string().trim().min(1, 'A cause is required.').max(128, 'Too long — 128 at most.'),
  event_date: z.string(),
  notes: z.string(),
})

type FormValues = z.infer<typeof schema>
const FIELDS = ['cause', 'event_date', 'notes'] as const

/**
 * `cause` is **free text, not an enum** (`String(128)` on the server), so this
 * is a plain input with examples in the hint. A chip set would quietly force
 * every death into one of five buckets the API never asked for.
 */
const COMMON_CAUSES = 'e.g. Scours, crushing, respiratory, sudden death'

/**
 * Recording a death.
 *
 * Manager-gated, irreversible, and it flips the animal to `deceased` in the
 * same transaction — so it sits behind an explicit confirmation rather than a
 * single tap. `POST /mortality-events` also 409s if that hog already has one,
 * and the server's own message is shown as-is: a generic "something went
 * wrong" on a 409 sends the user round the loop again.
 */
export default function MortalityForm() {
  const colors = useColors()
  const router = useRouter()
  const params = useLocalSearchParams<{ hogId?: string }>()
  const hogId = params.hogId ? Number(params.hogId) : null

  const today = useFarmToday()
  const { data: hog } = useHog(hogId ?? Number.NaN)
  const [success, setSuccess] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { cause: '', event_date: today, notes: '' },
    mode: 'onTouched',
  })

  const mutation = useFarmMutation((body: Record<string, unknown>) =>
    api.mutate<MortalityEvent>('POST', '/mortality-events', body),
  )

  const submit = form.handleSubmit(async (values) => {
    try {
      await mutation.mutateAsync({
        hog_id: hogId,
        event_date: values.event_date,
        cause: values.cause.trim(),
        ...(values.notes.trim() ? { notes: values.notes.trim() } : {}),
      })
      setSuccess(`${hog?.tag_number ?? 'The animal'} is recorded as deceased.`)
    } catch (cause) {
      applyFieldErrors(cause, form.setError, FIELDS)
      throw new Error(errorMessage(cause))
    }
  })

  const causeValue = useWatch({ control: form.control, name: 'cause' })

  // No animal chosen yet — send the user through the shared picker rather than
  // reimplementing it here.
  if (hogId === null || Number.isNaN(hogId)) {
    return (
      <CaptureScreen
        section="Herd"
        title="Record a death"
        submitLabel="Choose an animal"
        onSubmit={async () => router.replace('/capture/pick-hog?next=mortality')}
        canSubmit
        success={null}
        onAnother={() => {}}
      >
        <Text style={[text.body, { color: colors.muted }]}>
          Which animal died? You will confirm before anything is recorded.
        </Text>
      </CaptureScreen>
    )
  }

  return (
    <CaptureScreen
      section={hog?.tag_number ?? 'Herd'}
      title="Record a death"
      submitLabel="Record the death"
      onSubmit={submit}
      canSubmit={confirming && causeValue.trim().length > 0}
      success={success}
      note="This cannot be undone from the app."
      onAnother={() => {
        setSuccess(null)
        setConfirming(false)
        form.reset({ cause: '', event_date: today, notes: '' })
      }}
    >
      <Controller
        control={form.control}
        name="cause"
        render={({ field, fieldState }) => (
          <Field label="Cause" error={fieldState.error?.message} hint={COMMON_CAUSES}>
            <Input
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              placeholder="What happened"
              autoFocus
              autoCapitalize="sentences"
              invalid={Boolean(fieldState.error)}
            />
          </Field>
        )}
      />

      <Controller
        control={form.control}
        name="event_date"
        render={({ field, fieldState }) => (
          <DateField
            label="Date"
            value={field.value}
            onChange={field.onChange}
            today={today}
            error={fieldState.error?.message}
          />
        )}
      />

      <Controller
        control={form.control}
        name="notes"
        render={({ field }) => (
          <Field label="Notes" hint="Optional.">
            <Input
              value={field.value}
              onChangeText={field.onChange}
              placeholder="Anything worth recording"
              multiline
            />
          </Field>
        )}
      />

      {/* An irreversible action that also changes the animal's status is the
          wrong shape for a single tap. */}
      <View style={styles.confirm}>
        <Banner
          tone="alert"
          message={`This marks ${hog?.tag_number ?? 'this animal'} as deceased. It cannot be undone from the app.`}
        />
        {confirming ? (
          <Text style={[text.meta, { color: colors.muted }]}>
            Confirmed — the button below will record it.
          </Text>
        ) : (
          <Button
            label="I understand — let me record it"
            variant="outline"
            fullWidth
            onPress={() => setConfirming(true)}
          />
        )}
      </View>
    </CaptureScreen>
  )
}

const styles = StyleSheet.create({
  confirm: { gap: space.md },
})
