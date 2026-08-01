import { zodResolver } from '@hookform/resolvers/zod'
import { useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { z } from 'zod'

import { api } from '@/api-runtime'
import { CaptureScreen } from '@/components/capture/capture-screen'
import { DateField } from '@/components/capture/date-field'
import { applyFieldErrors } from '@/components/capture/field-errors'
import { Field, Input } from '@/components/ui/field'
import { useFarm, useFarmToday } from '@/hooks/use-farm'
import { useFarmMutation } from '@/hooks/use-farm-mutation'
import { useHog } from '@/hooks/use-hogs'
import { useRecentHogs } from '@/hooks/use-recent-hogs'
import { errorMessage } from '@/lib/api/errors'
import type { FeedRecord } from '@/lib/api/types'
import { formatNumber, normaliseDecimalInput } from '@/lib/format'

const DECIMAL = /^\d*[.,]?\d*$/

/** Both are `ge=0` on the server: a zero-cost entry is legitimate. */
const amount = (label: string) =>
  z
    .string()
    .min(1, `${label} is required.`)
    .regex(DECIMAL, 'Numbers only.')
    .refine((value) => Number(normaliseDecimalInput(value)) >= 0, 'Cannot be negative.')

const schema = z.object({
  feed_amount: amount('An amount'),
  feed_cost: amount('A cost'),
  record_date: z.string(),
})

type FormValues = z.infer<typeof schema>
const FIELDS = ['feed_amount', 'feed_cost', 'record_date'] as const

/**
 * Feed is **create-only** on mobile.
 *
 * A worker may only `PATCH` a feed record within 24 hours of creating it;
 * after that the API answers 403 "ask a manager". Shipping no edit screen
 * sidesteps that window entirely rather than building a control that works on
 * Tuesday and fails on Thursday.
 */
export default function FeedCapture() {
  const params = useLocalSearchParams<{ hogId: string }>()
  const hogId = Number(params.hogId)

  const today = useFarmToday()
  const { data: hog } = useHog(hogId)
  const farm = useFarm()
  const { remember } = useRecentHogs()
  const [success, setSuccess] = useState<string | null>(null)

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { feed_amount: '', feed_cost: '', record_date: today },
    mode: 'onTouched',
  })

  const mutation = useFarmMutation((body: Record<string, unknown>) =>
    api.mutate<FeedRecord>('POST', '/feed-records', body),
  )

  const submit = form.handleSubmit(async (values) => {
    try {
      await mutation.mutateAsync({
        hog_id: hogId,
        feed_amount: Number(normaliseDecimalInput(values.feed_amount)),
        feed_cost: Number(normaliseDecimalInput(values.feed_cost)),
        record_date: values.record_date,
        // `currency_code` is deliberately absent. The server stamps it from the
        // farm so a historical row keeps the currency it was entered in;
        // sending one is at best ignored.
      })
      remember(hogId)
      setSuccess(
        `${formatNumber(normaliseDecimalInput(values.feed_amount), 1)} kg of feed recorded for ${hog?.tag_number ?? 'this animal'}.`,
      )
    } catch (cause) {
      applyFieldErrors(cause, form.setError, FIELDS)
      throw new Error(errorMessage(cause))
    }
  })

  // See health-record.tsx: `form.watch()` defeats the React Compiler.
  const [feedAmount, feedCost] = useWatch({
    control: form.control,
    name: ['feed_amount', 'feed_cost'],
  })

  return (
    <CaptureScreen
      section={hog?.tag_number ?? 'Capture'}
      title="Feed"
      submitLabel="Save"
      onSubmit={submit}
      canSubmit={feedAmount.length > 0 && feedCost.length > 0}
      success={success}
      onAnother={() => {
        setSuccess(null)
        form.reset({ feed_amount: '', feed_cost: '', record_date: today })
      }}
    >
      <Controller
        control={form.control}
        name="feed_amount"
        render={({ field, fieldState }) => (
          <Field label="Amount" suffix="kg" error={fieldState.error?.message}>
            <Input
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              keyboardType="decimal-pad"
              placeholder="0.0"
              autoFocus
              invalid={Boolean(fieldState.error)}
            />
          </Field>
        )}
      />

      <Controller
        control={form.control}
        name="feed_cost"
        render={({ field, fieldState }) => (
          <Field
            label="Cost"
            // The farm's own currency, shown so nobody has to guess which one
            // they are typing. It is never sent.
            suffix={farm.data?.currency_code ?? ''}
            error={fieldState.error?.message}
          >
            <Input
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              keyboardType="decimal-pad"
              placeholder="0.00"
              invalid={Boolean(fieldState.error)}
            />
          </Field>
        )}
      />

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
