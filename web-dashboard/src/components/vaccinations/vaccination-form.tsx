'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'

import { FormFooter, HogPickerField } from '@/components/forms/form-parts'
import { Field, Input } from '@/components/ui/field'
import { Modal } from '@/components/ui/modal'
import { useFarm } from '@/hooks/use-farm'
import { useCreateVaccination } from '@/hooks/use-vaccinations'
import { ApiError } from '@/lib/api/client'
import { farmToday } from '@/lib/format'

const schema = z.object({
  hog_id: z.string().min(1, 'Choose an animal'),
  vaccine_name: z.string().min(1, 'Name the vaccine').max(128),
  dose_date: z.string().min(1, 'Choose a date'),
  next_due_date: z.string(),
  notes: z.string(),
})

type FormValues = z.input<typeof schema>

export function VaccinationForm({
  open,
  onClose,
  hogId,
}: {
  open: boolean
  onClose: () => void
  hogId?: number
}) {
  const farm = useFarm()
  const create = useCreateVaccination()
  const today = farmToday(farm.data?.timezone ?? 'UTC')

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      hog_id: hogId ? String(hogId) : '',
      vaccine_name: '',
      dose_date: today,
      next_due_date: '',
      notes: '',
    },
  })

  const close = () => {
    reset()
    onClose()
  }

  const onSubmit = handleSubmit(async (values) => {
    try {
      await create.mutateAsync({
        hog_id: Number(values.hog_id),
        vaccine_name: values.vaccine_name.trim(),
        dose_date: values.dose_date,
        next_due_date: values.next_due_date === '' ? null : values.next_due_date,
        notes: values.notes.trim() === '' ? null : values.notes.trim(),
      })
      toast.success('Vaccination recorded')
      close()
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Could not save the vaccination.')
    }
  })

  return (
    <Modal
      open={open}
      onClose={close}
      title="Record a vaccination"
      description="Vaccinations cannot be edited afterwards — the API is append-only."
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <HogPickerField id="vax-hog" error={errors.hog_id?.message} {...register('hog_id')} />

        <Field label="Vaccine" htmlFor="vax-name" error={errors.vaccine_name?.message}>
          <Input id="vax-name" placeholder="Erysipelas" {...register('vaccine_name')} />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Dose date" htmlFor="vax-date" error={errors.dose_date?.message}>
            <Input id="vax-date" type="date" max={today} {...register('dose_date')} />
          </Field>

          {/* The field that makes `vaccination_due` alerts possible at all: the
              rule evaluator has nothing to fire on until a dose says when the
              next one falls due. Deliberately not capped at today. */}
          <Field
            label="Next due"
            htmlFor="vax-next"
            error={errors.next_due_date?.message}
            hint="Drives the vaccination-due alert."
          >
            <Input id="vax-next" type="date" {...register('next_due_date')} />
          </Field>
        </div>

        <Field label="Notes" htmlFor="vax-notes" error={errors.notes?.message}>
          <Input id="vax-notes" placeholder="Optional" {...register('notes')} />
        </Field>

        <FormFooter submitLabel="Save vaccination" isSubmitting={isSubmitting} onCancel={close} />
      </form>
    </Modal>
  )
}
