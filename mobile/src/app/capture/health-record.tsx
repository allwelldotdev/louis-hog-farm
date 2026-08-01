import { zodResolver } from '@hookform/resolvers/zod'
import { useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { Text, View } from 'react-native'
import { z } from 'zod'

import { CaptureScreen } from '@/components/capture/capture-screen'
import { DateField } from '@/components/capture/date-field'
import { applyFieldErrors } from '@/components/capture/field-errors'
import { Button } from '@/components/ui/button'
import { Field, Input } from '@/components/ui/field'
import { api } from '@/api-runtime'
import { useFarmToday } from '@/hooks/use-farm'
import { useFarmMutation } from '@/hooks/use-farm-mutation'
import { useHog } from '@/hooks/use-hogs'
import { useRecentHogs } from '@/hooks/use-recent-hogs'
import { errorMessage } from '@/lib/api/errors'
import type { HealthRecord } from '@/lib/api/types'
import { formatNumber, normaliseDecimalInput } from '@/lib/format'
import { useColors } from '@/theme/theme-provider'
import { text } from '@/theme/type'

/**
 * Weigh-in and health check are one screen because they are one endpoint.
 *
 * `POST /health-records` carries weight, temperature and notes; there is no
 * separate weight table. `mode` only decides what gets focus and what starts
 * collapsed:
 *
 *   weigh — the scale reading, thermometer and notes behind a disclosure
 *   check — all three open, temperature focused
 *
 * **Weight is required in both**, because the server requires it (`gt=0`). The
 * check mode says so on the field rather than letting a 422 explain it after
 * the fact.
 */

const DECIMAL = /^\d*[.,]?\d*$/

const schema = z.object({
  weight: z
    .string()
    .min(1, 'A weight is needed — the server requires one on every health record.')
    .regex(DECIMAL, 'Numbers only.')
    .refine((value) => Number(normaliseDecimalInput(value)) > 0, 'Must be more than 0.'),
  temperature: z
    .string()
    .refine((value) => value === '' || DECIMAL.test(value), 'Numbers only.')
    .refine((value) => {
      if (value === '') return true
      const parsed = Number(normaliseDecimalInput(value))
      // The server does no range check at all, so a fat-fingered 385 is stored
      // and quietly poisons the record. 35–43 °C is the live range for a pig.
      return parsed >= 35 && parsed <= 43
    }, 'That looks out of range for a pig — check the reading.'),
  notes: z.string(),
  record_date: z.string(),
})

type FormValues = z.infer<typeof schema>
const FIELDS = ['weight', 'temperature', 'notes', 'record_date'] as const

export default function HealthRecordCapture() {
  const colors = useColors()
  const params = useLocalSearchParams<{ hogId: string; mode?: string }>()
  const hogId = Number(params.hogId)
  const check = params.mode === 'check'

  const today = useFarmToday()
  const { data: hog } = useHog(hogId)
  const { remember } = useRecentHogs()

  const [success, setSuccess] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(check)

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { weight: '', temperature: '', notes: '', record_date: today },
    mode: 'onTouched',
  })

  const mutation = useFarmMutation((body: Record<string, unknown>) =>
    api.mutate<HealthRecord>('POST', '/health-records', body),
  )

  const submit = form.handleSubmit(async (values) => {
    try {
      await mutation.mutateAsync({
        hog_id: hogId,
        weight: Number(normaliseDecimalInput(values.weight)),
        // Omitted rather than null: a PATCH-style null means "leave unchanged"
        // everywhere in this API, and there is no reason to send an empty key.
        ...(values.temperature
          ? { temperature: Number(normaliseDecimalInput(values.temperature)) }
          : {}),
        ...(values.notes.trim() ? { notes: values.notes.trim() } : {}),
        record_date: values.record_date,
      })
      remember(hogId)
      setSuccess(
        `${formatNumber(normaliseDecimalInput(values.weight), 1)} kg recorded for ${hog?.tag_number ?? 'this animal'}.`,
      )
    } catch (cause) {
      applyFieldErrors(cause, form.setError, FIELDS)
      // Rethrown so CaptureScreen shows the banner and relabels the button;
      // the form itself stays mounted with every typed value intact.
      throw new Error(errorMessage(cause))
    }
  })

  function another() {
    setSuccess(null)
    setExpanded(check)
    form.reset({ weight: '', temperature: '', notes: '', record_date: today })
  }

  // `useWatch`, not `form.watch()`: the latter returns a fresh function the
  // React Compiler cannot memoize, so it bails out of optimising the whole
  // screen — and this screen is the one that has to feel instant.
  const weight = useWatch({ control: form.control, name: 'weight' })

  return (
    <CaptureScreen
      section={hog?.tag_number ?? 'Capture'}
      title={check ? 'Health check' : 'Weigh-in'}
      submitLabel="Save"
      onSubmit={submit}
      canSubmit={weight.length > 0}
      success={success}
      onAnother={another}
    >
      <Controller
        control={form.control}
        name="weight"
        render={({ field, fieldState }) => (
          <Field label="Weight" suffix="kg" error={fieldState.error?.message}>
            <Input
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              // `decimal-pad`, never `numeric`: numeric shows a full symbol
              // keyboard on Android.
              keyboardType="decimal-pad"
              placeholder="0.0"
              autoFocus={!check}
              invalid={Boolean(fieldState.error)}
              returnKeyType="done"
            />
          </Field>
        )}
      />

      {expanded ? (
        <>
          <Controller
            control={form.control}
            name="temperature"
            render={({ field, fieldState }) => (
              <Field
                label="Temperature"
                suffix="°C"
                error={fieldState.error?.message}
                hint="Optional. Normal is about 38.5 °C."
              >
                <Input
                  value={field.value}
                  onChangeText={field.onChange}
                  onBlur={field.onBlur}
                  keyboardType="decimal-pad"
                  placeholder="38.5"
                  autoFocus={check}
                  invalid={Boolean(fieldState.error)}
                />
              </Field>
            )}
          />

          <Controller
            control={form.control}
            name="notes"
            render={({ field }) => (
              <Field label="Notes" hint="Optional. What you saw.">
                <Input
                  value={field.value}
                  onChangeText={field.onChange}
                  placeholder="Off feed, lame on left hind…"
                  multiline
                />
              </Field>
            )}
          />
        </>
      ) : (
        <View>
          <Button
            label="Add temperature or a note"
            variant="outline"
            onPress={() => setExpanded(true)}
          />
          <Text style={[text.meta, { color: colors.muted, marginTop: 8 }]}>
            Most weigh-ins need nothing else.
          </Text>
        </View>
      )}

      <Controller
        control={form.control}
        name="record_date"
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
    </CaptureScreen>
  )
}
