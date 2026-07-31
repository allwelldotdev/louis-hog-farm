'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'

import { FormFooter, HogPickerField } from '@/components/forms/form-parts'
import { Field, Input } from '@/components/ui/field'
import { Modal } from '@/components/ui/modal'
import { useFarm } from '@/hooks/use-farm'
import { useCreateHealthRecord } from '@/hooks/use-records'
import { ApiError } from '@/lib/api/client'
import { farmToday } from '@/lib/format'

/**
 * Form shape only.
 *
 * The API's own types come from `schema.d.ts`, generated from the OpenAPI
 * document — re-describing the request body in zod would create a second
 * contract to keep in step with the first. What zod covers here is what an
 * HTML form actually produces: strings, some of them empty, that have to become
 * numbers or be dropped.
 */
const schema = z.object({
  hog_id: z.string().min(1, 'Choose an animal'),
  record_date: z.string().min(1, 'Choose a date'),
  // Split from the number check so a blank field says "required" rather than
  // "must be greater than zero" — `coerce` turns '' into 0 and the positivity
  // message then blames the user for a value they never typed.
  weight: z
    .string()
    .min(1, 'Weight is required')
    .transform(Number)
    .pipe(z.number().positive('Weight must be greater than zero')),
  // Empty stays empty: an omitted temperature is not the same claim as 0 °C,
  // and the column is nullable precisely because it is often not taken.
  temperature: z.union([
    z.literal(''),
    z.string().transform(Number).pipe(z.number().positive('Temperature must be greater than zero')),
  ]),
  notes: z.string(),
})

/** What the DOM hands back, and what zod turns it into. Declaring both to
 *  `useForm` is what lets the submit handler receive parsed numbers instead of
 *  re-parsing the strings itself. */
type FormValues = z.input<typeof schema>
type Parsed = z.output<typeof schema>

export function HealthRecordForm({
  open,
  onClose,
  hogId,
}: {
  open: boolean
  onClose: () => void
  /** Pre-selected when the form is opened from an animal's own page. */
  hogId?: number
}) {
  const farm = useFarm()
  const create = useCreateHealthRecord()
  const today = farmToday(farm.data?.timezone ?? 'UTC')

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
      weight: '',
      temperature: '',
      notes: '',
    },
  })

  const close = () => {
    reset()
    onClose()
  }

  const onSubmit = handleSubmit(async (parsed) => {
    try {
      await create.mutateAsync({
        hog_id: Number(parsed.hog_id),
        record_date: parsed.record_date,
        weight: parsed.weight,
        temperature: parsed.temperature === '' ? null : parsed.temperature,
        notes: parsed.notes.trim() === '' ? null : parsed.notes.trim(),
      })
      toast.success('Weigh-in recorded')
      close()
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Could not save the record.')
    }
  })

  return (
    <Modal
      open={open}
      onClose={close}
      title="Record a weigh-in"
      description="Weight is required; temperature and notes are not."
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <HogPickerField id="health-hog" error={errors.hog_id?.message} {...register('hog_id')} />

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Date" htmlFor="health-date" error={errors.record_date?.message}>
            {/* Capped at the farm's today, not the browser's — the server
                validates against `farm_today(timezone)`. */}
            <Input id="health-date" type="date" max={today} {...register('record_date')} />
          </Field>

          <Field label="Weight (kg)" htmlFor="health-weight" error={errors.weight?.message}>
            <Input
              id="health-weight"
              type="number"
              step="0.1"
              min="0"
              inputMode="decimal"
              {...register('weight')}
            />
          </Field>
        </div>

        <Field
          label="Temperature (°C)"
          htmlFor="health-temp"
          error={errors.temperature?.message}
          hint="Leave blank if it was not taken."
        >
          <Input
            id="health-temp"
            type="number"
            step="0.1"
            min="0"
            inputMode="decimal"
            {...register('temperature')}
          />
        </Field>

        <Field label="Notes" htmlFor="health-notes" error={errors.notes?.message}>
          <Input id="health-notes" placeholder="Routine check" {...register('notes')} />
        </Field>

        <FormFooter submitLabel="Save weigh-in" isSubmitting={isSubmitting} onCancel={close} />
      </form>
    </Modal>
  )
}
