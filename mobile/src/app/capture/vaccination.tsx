import { zodResolver } from '@hookform/resolvers/zod'
import { useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { z } from 'zod'

import { api } from '@/api-runtime'
import { CaptureScreen } from '@/components/capture/capture-screen'
import { DateField } from '@/components/capture/date-field'
import { applyFieldErrors } from '@/components/capture/field-errors'
import { Button } from '@/components/ui/button'
import { Field, Input } from '@/components/ui/field'
import { useFarmToday } from '@/hooks/use-farm'
import { useFarmMutation } from '@/hooks/use-farm-mutation'
import { useHog } from '@/hooks/use-hogs'
import { useRecentHogs } from '@/hooks/use-recent-hogs'
import { errorMessage } from '@/lib/api/errors'
import type { Vaccination } from '@/lib/api/types'
import { addDays } from '@/lib/format'

const schema = z
  .object({
    vaccine_name: z.string().trim().min(1, 'Which vaccine?').max(128, 'Too long — 128 at most.'),
    dose_date: z.string(),
    next_due_date: z.string(),
    notes: z.string(),
  })
  .refine((values) => !values.next_due_date || values.next_due_date >= values.dose_date, {
    path: ['next_due_date'],
    message: 'The next dose cannot be due before this one was given.',
  })

type FormValues = z.infer<typeof schema>
const FIELDS = ['vaccine_name', 'dose_date', 'next_due_date', 'notes'] as const

/** A sensible default gap when someone opts into a reminder. */
const DEFAULT_INTERVAL_DAYS = 28

/**
 * Vaccinations are **write-once**: the API has no PATCH and no GET-by-id.
 *
 * That has to be said before the tap, not discovered afterwards, so the note
 * rides on the form and repeats on the confirmation. Someone expecting to fix
 * a typo later needs to know now.
 *
 * `next_due_date` is the one forward-looking date in the app — it is a
 * reminder, so the shared no-future rule must not be applied to it.
 */
export default function VaccinationCapture() {
  const params = useLocalSearchParams<{ hogId: string }>()
  const hogId = Number(params.hogId)

  const today = useFarmToday()
  const { data: hog } = useHog(hogId)
  const { remember } = useRecentHogs()
  const [success, setSuccess] = useState<string | null>(null)
  const [wantsReminder, setWantsReminder] = useState(false)

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { vaccine_name: '', dose_date: today, next_due_date: '', notes: '' },
    mode: 'onTouched',
  })

  const mutation = useFarmMutation((body: Record<string, unknown>) =>
    api.mutate<Vaccination>('POST', '/vaccinations', body),
  )

  const submit = form.handleSubmit(async (values) => {
    try {
      await mutation.mutateAsync({
        hog_id: hogId,
        vaccine_name: values.vaccine_name.trim(),
        dose_date: values.dose_date,
        ...(values.next_due_date ? { next_due_date: values.next_due_date } : {}),
        ...(values.notes.trim() ? { notes: values.notes.trim() } : {}),
      })
      remember(hogId)
      setSuccess(`${values.vaccine_name.trim()} recorded for ${hog?.tag_number ?? 'this animal'}.`)
    } catch (cause) {
      applyFieldErrors(cause, form.setError, FIELDS)
      throw new Error(errorMessage(cause))
    }
  })

  // See health-record.tsx: `form.watch()` defeats the React Compiler.
  const [vaccineName, doseDate, nextDueDate] = useWatch({
    control: form.control,
    name: ['vaccine_name', 'dose_date', 'next_due_date'],
  })

  return (
    <CaptureScreen
      section={hog?.tag_number ?? 'Capture'}
      title="Vaccination"
      submitLabel="Save"
      onSubmit={submit}
      canSubmit={vaccineName.trim().length > 0}
      success={success}
      note="Vaccinations cannot be edited once saved."
      onAnother={() => {
        setSuccess(null)
        setWantsReminder(false)
        form.reset({ vaccine_name: '', dose_date: today, next_due_date: '', notes: '' })
      }}
    >
      <Controller
        control={form.control}
        name="vaccine_name"
        render={({ field, fieldState }) => (
          <Field label="Vaccine" error={fieldState.error?.message}>
            <Input
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              placeholder="e.g. Erysipelas"
              autoFocus
              autoCapitalize="sentences"
              invalid={Boolean(fieldState.error)}
            />
          </Field>
        )}
      />

      <Controller
        control={form.control}
        name="dose_date"
        render={({ field, fieldState }) => (
          <DateField
            label="Given on"
            value={field.value}
            onChange={field.onChange}
            today={today}
            error={fieldState.error?.message}
          />
        )}
      />

      {wantsReminder || nextDueDate ? (
        <Controller
          control={form.control}
          name="next_due_date"
          render={({ field, fieldState }) => (
            <DateField
              label="Next dose due"
              value={field.value || addDays(doseDate, DEFAULT_INTERVAL_DAYS)}
              onChange={field.onChange}
              today={today}
              allowFuture
              error={fieldState.error?.message}
            />
          )}
        />
      ) : (
        <Button
          label="Set a next-dose reminder"
          variant="outline"
          onPress={() => {
            setWantsReminder(true)
            form.setValue('next_due_date', addDays(doseDate, DEFAULT_INTERVAL_DAYS))
          }}
        />
      )}

      <Controller
        control={form.control}
        name="notes"
        render={({ field }) => (
          <Field label="Notes" hint="Optional. Batch number, who administered it.">
            <Input
              value={field.value}
              onChangeText={field.onChange}
              placeholder="Batch 4471"
              multiline
            />
          </Field>
        )}
      />
    </CaptureScreen>
  )
}
