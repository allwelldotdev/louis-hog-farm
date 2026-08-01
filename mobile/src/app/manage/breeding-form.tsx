import { zodResolver } from '@hookform/resolvers/zod'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { Text } from 'react-native'
import { z } from 'zod'

import { api } from '@/api-runtime'
import { CaptureScreen } from '@/components/capture/capture-screen'
import { DateField } from '@/components/capture/date-field'
import { applyFieldErrors } from '@/components/capture/field-errors'
import { Field, Input } from '@/components/ui/field'
import { useFarmToday } from '@/hooks/use-farm'
import { useFarmMutation } from '@/hooks/use-farm-mutation'
import { useHog } from '@/hooks/use-hogs'
import { errorMessage } from '@/lib/api/errors'
import type { BreedingCycle } from '@/lib/api/types'
import { addDays, formatBusinessDate } from '@/lib/format'
import { useColors } from '@/theme/theme-provider'
import { text } from '@/theme/type'

const GESTATION_DAYS = 114

const schema = z.object({
  start_date: z.string(),
  notes: z.string(),
})

type FormValues = z.infer<typeof schema>
const FIELDS = ['start_date', 'notes'] as const

/**
 * Opening a breeding cycle.
 *
 * The picker that reaches this screen is restricted to sows and gilts, because
 * `POST /breeding-cycles` 400s for anything else — the constraint is enforced
 * where the choice is made rather than after the submit.
 */
export default function BreedingForm() {
  const colors = useColors()
  const router = useRouter()
  const params = useLocalSearchParams<{ hogId?: string }>()
  const hogId = params.hogId ? Number(params.hogId) : null

  const today = useFarmToday()
  const { data: hog } = useHog(hogId ?? Number.NaN)
  const [success, setSuccess] = useState<string | null>(null)

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { start_date: today, notes: '' },
    mode: 'onTouched',
  })

  const mutation = useFarmMutation((body: Record<string, unknown>) =>
    api.mutate<BreedingCycle>('POST', '/breeding-cycles', body),
  )

  const submit = form.handleSubmit(async (values) => {
    try {
      await mutation.mutateAsync({
        hog_id: hogId,
        start_date: values.start_date,
        ...(values.notes.trim() ? { notes: values.notes.trim() } : {}),
      })
      setSuccess(
        `Cycle opened for ${hog?.tag_number ?? 'this sow'}. Farrowing due about ${formatBusinessDate(
          addDays(values.start_date, GESTATION_DAYS),
          { dateStyle: 'medium' },
        )}.`,
      )
    } catch (cause) {
      applyFieldErrors(cause, form.setError, FIELDS)
      throw new Error(errorMessage(cause))
    }
  })

  if (hogId === null || Number.isNaN(hogId)) {
    return (
      <CaptureScreen
        section="Herd"
        title="Open a cycle"
        submitLabel="Choose a sow or gilt"
        onSubmit={async () => router.replace('/capture/pick-hog?next=breeding&restrictTo=breeding')}
        canSubmit
        success={null}
        onAnother={() => {}}
      >
        <Text style={[text.body, { color: colors.muted }]}>
          Breeding cycles apply to sows and gilts only.
        </Text>
      </CaptureScreen>
    )
  }

  return (
    <CaptureScreen
      section={hog?.tag_number ?? 'Herd'}
      title="Open a cycle"
      submitLabel="Open cycle"
      onSubmit={submit}
      canSubmit
      success={success}
      onAnother={() => {
        setSuccess(null)
        form.reset({ start_date: today, notes: '' })
      }}
    >
      <Controller
        control={form.control}
        name="start_date"
        render={({ field, fieldState }) => (
          <DateField
            label="Served on"
            value={field.value}
            onChange={field.onChange}
            today={today}
            error={fieldState.error?.message}
          />
        )}
      />

      <Text style={[text.meta, { color: colors.muted }]}>
        Farrowing due about{' '}
        {formatBusinessDate(addDays(form.getValues('start_date'), GESTATION_DAYS), {
          dateStyle: 'medium',
        })}
        {' — '}
        {GESTATION_DAYS} days after service.
      </Text>

      <Controller
        control={form.control}
        name="notes"
        render={({ field }) => (
          <Field label="Notes" hint="Optional. Boar used, method.">
            <Input
              value={field.value}
              onChangeText={field.onChange}
              placeholder="AI, boar H1-1001"
              multiline
            />
          </Field>
        )}
      />
    </CaptureScreen>
  )
}
