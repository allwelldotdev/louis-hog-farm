'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'

import { FormFooter, HogPickerField } from '@/components/forms/form-parts'
import { Field, Input } from '@/components/ui/field'
import { Modal } from '@/components/ui/modal'
import { useFarm } from '@/hooks/use-farm'
import { useCreateFeedRecord } from '@/hooks/use-records'
import { ApiError } from '@/lib/api/client'
import { farmToday } from '@/lib/format'

/** Form shape only — the request type comes from `schema.d.ts`. Both amounts
 *  may be zero (a day the animal was not fed is a real entry), unlike weight. */
const schema = z.object({
  hog_id: z.string().min(1, 'Choose an animal'),
  record_date: z.string().min(1, 'Choose a date'),
  // Split from the number check so a blank field reads as "required" rather
  // than passing silently — `coerce` turns '' into 0, which is a valid amount.
  feed_amount: z
    .string()
    .min(1, 'Amount is required')
    .transform(Number)
    .pipe(z.number().nonnegative('Amount cannot be negative')),
  feed_cost: z
    .string()
    .min(1, 'Cost is required')
    .transform(Number)
    .pipe(z.number().nonnegative('Cost cannot be negative')),
})

type FormValues = z.input<typeof schema>
type Parsed = z.output<typeof schema>

export function FeedRecordForm({
  open,
  onClose,
  hogId,
}: {
  open: boolean
  onClose: () => void
  hogId?: number
}) {
  const farm = useFarm()
  const create = useCreateFeedRecord()
  const today = farmToday(farm.data?.timezone ?? 'UTC')
  const currency = farm.data?.currency_code ?? 'NGN'

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues, unknown, Parsed>({
    resolver: zodResolver(schema),
    defaultValues: {
      hog_id: hogId ? String(hogId) : '',
      record_date: today,
      feed_amount: '',
      feed_cost: '',
    },
  })

  const close = () => {
    reset()
    onClose()
  }

  const onSubmit = handleSubmit(async (parsed) => {
    try {
      // No `currency_code`: the API fills it from the farm, and sending one was
      // what let a single farm accumulate mixed currencies (audit i).
      await create.mutateAsync({
        hog_id: Number(parsed.hog_id),
        record_date: parsed.record_date,
        feed_amount: parsed.feed_amount,
        feed_cost: parsed.feed_cost,
      })
      toast.success('Feed recorded')
      close()
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Could not save the record.')
    }
  })

  return (
    <Modal
      open={open}
      onClose={close}
      title="Record feed"
      description={`Cost is recorded in ${currency}, the farm's currency.`}
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <HogPickerField id="feed-hog" error={errors.hog_id?.message} {...register('hog_id')} />

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Date" htmlFor="feed-date" error={errors.record_date?.message}>
            <Input id="feed-date" type="date" max={today} {...register('record_date')} />
          </Field>

          <Field label="Amount (kg)" htmlFor="feed-amount" error={errors.feed_amount?.message}>
            <Input
              id="feed-amount"
              type="number"
              step="0.01"
              min="0"
              inputMode="decimal"
              {...register('feed_amount')}
            />
          </Field>

          <Field label={`Cost (${currency})`} htmlFor="feed-cost" error={errors.feed_cost?.message}>
            <Input
              id="feed-cost"
              type="number"
              step="0.01"
              min="0"
              inputMode="decimal"
              {...register('feed_cost')}
            />
          </Field>
        </div>

        <FormFooter submitLabel="Save feed record" isSubmitting={isSubmitting} onCancel={close} />
      </form>
    </Modal>
  )
}
