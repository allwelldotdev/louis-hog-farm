'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'

import { FormFooter, HogPickerField } from '@/components/forms/form-parts'
import { Field, Input, Select } from '@/components/ui/field'
import { Modal } from '@/components/ui/modal'
import { useCreateBreedingCycle, useUpdateBreedingCycle } from '@/hooks/use-breeding'
import { useFarm } from '@/hooks/use-farm'
import { ApiError } from '@/lib/api/client'
import type { BreedingCycle, ProductionClass } from '@/lib/api/types'
import { farmToday, formatBusinessDate } from '@/lib/format'

/** The API rejects a cycle with 400 unless the hog is one of these, so the
 *  picker offers nothing else. A dropdown that lets you choose a boar and then
 *  refuses the submission is the same rule, told worse. */
const BREEDING_CLASSES: readonly ProductionClass[] = ['sow', 'gilt']

const openSchema = z.object({
  hog_id: z.string().min(1, 'Choose a sow or gilt'),
  start_date: z.string().min(1, 'Choose a start date'),
  notes: z.string(),
})

export function OpenCycleForm({ open, onClose }: { open: boolean; onClose: () => void }) {
  const farm = useFarm()
  const create = useCreateBreedingCycle()
  const today = farmToday(farm.data?.timezone ?? 'UTC')

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<z.input<typeof openSchema>>({
    resolver: zodResolver(openSchema),
    defaultValues: { hog_id: '', start_date: today, notes: '' },
  })

  const close = () => {
    reset()
    onClose()
  }

  const onSubmit = handleSubmit(async (values) => {
    try {
      await create.mutateAsync({
        hog_id: Number(values.hog_id),
        start_date: values.start_date,
        notes: values.notes.trim() === '' ? null : values.notes.trim(),
      })
      toast.success('Breeding cycle opened')
      close()
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Could not open the cycle.')
    }
  })

  return (
    <Modal
      open={open}
      onClose={close}
      title="Open a breeding cycle"
      description="Sows and gilts only. Gestation runs about 114 days."
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <HogPickerField
          id="cycle-hog"
          label="Sow or gilt"
          error={errors.hog_id?.message}
          restrictTo={BREEDING_CLASSES}
          {...register('hog_id')}
        />

        <Field label="Served on" htmlFor="cycle-start" error={errors.start_date?.message}>
          <Input id="cycle-start" type="date" max={today} {...register('start_date')} />
        </Field>

        <Field label="Notes" htmlFor="cycle-notes" error={errors.notes?.message}>
          <Input id="cycle-notes" placeholder="Optional" {...register('notes')} />
        </Field>

        <FormFooter submitLabel="Open cycle" isSubmitting={isSubmitting} onCancel={close} />
      </form>
    </Modal>
  )
}

const closeSchema = z.object({
  end_date: z.string().min(1, 'Choose an end date'),
  status: z.enum(['completed', 'aborted']),
  notes: z.string(),
})

/**
 * Closing a cycle.
 *
 * The API allows exactly one transition — `ongoing` to `completed` or
 * `aborted`, with an `end_date` — and nothing but the notes may change
 * afterwards. So this is a two-field form rather than an edit dialog, and it is
 * offered only on ongoing rows.
 */
export function CloseCycleForm({
  cycle,
  onClose,
}: {
  cycle: BreedingCycle | null
  onClose: () => void
}) {
  const farm = useFarm()
  const update = useUpdateBreedingCycle()
  const today = farmToday(farm.data?.timezone ?? 'UTC')

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<z.input<typeof closeSchema>>({
    resolver: zodResolver(closeSchema),
    values: { end_date: today, status: 'completed', notes: cycle?.notes ?? '' },
  })

  const close = () => {
    reset()
    onClose()
  }

  const onSubmit = handleSubmit(async (values) => {
    if (!cycle) return
    try {
      await update.mutateAsync({
        id: cycle.id,
        end_date: values.end_date,
        status: values.status,
        notes: values.notes.trim() === '' ? null : values.notes.trim(),
      })
      toast.success('Breeding cycle closed')
      close()
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Could not close the cycle.')
    }
  })

  return (
    <Modal
      open={cycle !== null}
      onClose={close}
      title="Close breeding cycle"
      description={
        cycle
          ? `Opened ${formatBusinessDate(cycle.start_date, { dateStyle: 'medium' })}. Only the notes can be changed afterwards.`
          : undefined
      }
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Ended on" htmlFor="close-end" error={errors.end_date?.message}>
            <Input
              id="close-end"
              type="date"
              min={cycle?.start_date}
              max={today}
              {...register('end_date')}
            />
          </Field>

          <Field label="Outcome" htmlFor="close-status" error={errors.status?.message}>
            <Select id="close-status" className="h-10 w-full" {...register('status')}>
              <option value="completed">Farrowed</option>
              <option value="aborted">Aborted</option>
            </Select>
          </Field>
        </div>

        <Field label="Notes" htmlFor="close-notes" error={errors.notes?.message}>
          <Input id="close-notes" placeholder="Optional" {...register('notes')} />
        </Field>

        <FormFooter submitLabel="Close cycle" isSubmitting={isSubmitting} onCancel={close} />
      </form>
    </Modal>
  )
}
