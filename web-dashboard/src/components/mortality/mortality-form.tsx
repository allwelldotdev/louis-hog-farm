'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'

import { FormFooter, HogPickerField } from '@/components/forms/form-parts'
import { Field, Input } from '@/components/ui/field'
import { Modal } from '@/components/ui/modal'
import { useFarm } from '@/hooks/use-farm'
import { useCreateMortalityEvent } from '@/hooks/use-mortality'
import { ApiError } from '@/lib/api/client'
import { farmToday } from '@/lib/format'

const schema = z.object({
  hog_id: z.string().min(1, 'Choose an animal'),
  event_date: z.string().min(1, 'Choose a date'),
  cause: z.string().min(1, 'A cause is required').max(128),
  notes: z.string(),
})

type FormValues = z.input<typeof schema>

export function MortalityForm({ open, onClose }: { open: boolean; onClose: () => void }) {
  const farm = useFarm()
  const create = useCreateMortalityEvent()
  const today = farmToday(farm.data?.timezone ?? 'UTC')

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { hog_id: '', event_date: today, cause: '', notes: '' },
  })

  const close = () => {
    reset()
    onClose()
  }

  const onSubmit = handleSubmit(async (values) => {
    try {
      await create.mutateAsync({
        hog_id: Number(values.hog_id),
        event_date: values.event_date,
        cause: values.cause.trim(),
        notes: values.notes.trim() === '' ? null : values.notes.trim(),
      })
      toast.success('Death recorded; the animal is now marked deceased')
      close()
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Could not record the death.')
    }
  })

  return (
    <Modal
      open={open}
      onClose={close}
      title="Record a death"
      // Stated up front because it is the one hog transition that cannot be
      // undone by re-editing a field: the server sets the status in the same
      // transaction, and there is no PATCH on this resource.
      description="This also marks the animal deceased. It cannot be undone."
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <HogPickerField id="mort-hog" error={errors.hog_id?.message} {...register('hog_id')} />

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Date" htmlFor="mort-date" error={errors.event_date?.message}>
            <Input id="mort-date" type="date" max={today} {...register('event_date')} />
          </Field>

          <Field label="Cause" htmlFor="mort-cause" error={errors.cause?.message}>
            <Input id="mort-cause" placeholder="Respiratory illness" {...register('cause')} />
          </Field>
        </div>

        <Field label="Notes" htmlFor="mort-notes" error={errors.notes?.message}>
          <Input id="mort-notes" placeholder="Optional" {...register('notes')} />
        </Field>

        <FormFooter submitLabel="Record death" isSubmitting={isSubmitting} onCancel={close} />
      </form>
    </Modal>
  )
}
