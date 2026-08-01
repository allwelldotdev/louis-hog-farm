'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'

import { FormFooter, HogPickerField } from '@/components/forms/form-parts'
import { Field, Input, Select } from '@/components/ui/field'
import { Modal } from '@/components/ui/modal'
import { useFarm } from '@/hooks/use-farm'
import { useCreateHog, useUpdateHog } from '@/hooks/use-hogs'
import { ApiError } from '@/lib/api/client'
import type { Hog, HogSex, HogStatus, ProductionClass } from '@/lib/api/types'
import { farmToday, humanize } from '@/lib/format'

/**
 * The only way an animal enters the herd from the dashboard, and the only way
 * lineage is ever recorded.
 *
 * One modal for create and edit: the fields are the same animal either way, and
 * two forms differing by a status field would drift apart. `hog` present means
 * edit.
 */

const SEXES: HogSex[] = ['female', 'male']

const PRODUCTION_CLASSES: ProductionClass[] = [
  'piglet',
  'weaner',
  'grower',
  'finisher',
  'gilt',
  'sow',
  'boar',
]

const STATUSES: HogStatus[] = ['active', 'archived']

// The API rejects a dam that is not female and a sire that is not male, so the
// pickers offer only what it will accept rather than letting the server refuse
// a submission the form could have prevented.
const DAM_CLASSES: readonly ProductionClass[] = ['sow', 'gilt']
const SIRE_CLASSES: readonly ProductionClass[] = ['boar']

const schema = z.object({
  tag_number: z.string().min(1, 'Give the animal a tag').max(64),
  birth_date: z.string().min(1, 'Choose a birth date'),
  breed: z.string().min(1, 'Name the breed').max(128),
  sex: z.string().min(1),
  production_class: z.string().min(1),
  status: z.string(),
  dam_id: z.string(),
  sire_id: z.string(),
})

type FormValues = z.input<typeof schema>

function toId(value: string): number | null {
  return value === '' ? null : Number(value)
}

export function HogForm({ open, onClose, hog }: { open: boolean; onClose: () => void; hog?: Hog }) {
  const farm = useFarm()
  const today = farmToday(farm.data?.timezone ?? 'UTC')
  const create = useCreateHog()
  const update = useUpdateHog(hog?.id ?? 0)
  const isEdit = hog !== undefined

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    values: {
      tag_number: hog?.tag_number ?? '',
      birth_date: hog?.birth_date ?? today,
      breed: hog?.breed ?? '',
      sex: hog?.sex ?? 'female',
      production_class: hog?.production_class ?? 'piglet',
      status: hog?.status ?? 'active',
      dam_id: hog?.dam_id === null || hog?.dam_id === undefined ? '' : String(hog.dam_id),
      sire_id: hog?.sire_id === null || hog?.sire_id === undefined ? '' : String(hog.sire_id),
    },
  })

  const close = () => {
    reset()
    onClose()
  }

  const onSubmit = handleSubmit(async (values) => {
    const common = {
      tag_number: values.tag_number.trim(),
      birth_date: values.birth_date,
      breed: values.breed.trim(),
      sex: values.sex as HogSex,
      production_class: values.production_class as ProductionClass,
      // Always sent, including as null: the API distinguishes an absent key from
      // an explicit null on these two fields, and null is how a parent recorded
      // in error is removed.
      dam_id: toId(values.dam_id),
      sire_id: toId(values.sire_id),
    }

    try {
      if (isEdit) {
        await update.mutateAsync({ ...common, status: values.status as HogStatus })
        toast.success('Hog updated')
      } else {
        await create.mutateAsync(common)
        toast.success('Hog added')
      }
      close()
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Could not save the animal.')
    }
  })

  return (
    <Modal
      open={open}
      onClose={close}
      title={isEdit ? `Edit ${hog.tag_number}` : 'Add a hog'}
      description={
        isEdit
          ? 'Lineage can be cleared here as well as set.'
          : 'Dam and sire are optional — record them for animals born on this farm.'
      }
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Tag number" htmlFor="hogform-tag" error={errors.tag_number?.message}>
            <Input id="hogform-tag" placeholder="H1-1019" {...register('tag_number')} />
          </Field>

          <Field label="Breed" htmlFor="hogform-breed" error={errors.breed?.message}>
            <Input id="hogform-breed" placeholder="Duroc" {...register('breed')} />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Born"
            htmlFor="hogform-birth"
            error={errors.birth_date?.message}
            hint="A parent must be older than the animal."
          >
            <Input id="hogform-birth" type="date" max={today} {...register('birth_date')} />
          </Field>

          <Field label="Sex" htmlFor="hogform-sex" error={errors.sex?.message}>
            <Select id="hogform-sex" className="h-10 w-full" {...register('sex')}>
              {SEXES.map((value) => (
                <option key={value} value={value}>
                  {humanize(value)}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Class" htmlFor="hogform-class" error={errors.production_class?.message}>
            <Select id="hogform-class" className="h-10 w-full" {...register('production_class')}>
              {PRODUCTION_CLASSES.map((value) => (
                <option key={value} value={value}>
                  {humanize(value)}
                </option>
              ))}
            </Select>
          </Field>

          {/* Only on edit: a new animal joins the herd active, and `deceased` is
              set by recording a mortality event, not by picking it from a list. */}
          {isEdit ? (
            <Field label="Status" htmlFor="hogform-status" error={errors.status?.message}>
              <Select
                id="hogform-status"
                className="h-10 w-full"
                disabled={hog.status === 'deceased'}
                {...register('status')}
              >
                {(hog.status === 'deceased' ? ['deceased', ...STATUSES] : STATUSES).map((value) => (
                  <option key={value} value={value}>
                    {humanize(value)}
                  </option>
                ))}
              </Select>
            </Field>
          ) : null}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <HogPickerField
            id="hogform-dam"
            label="Dam"
            optional
            includeInactive
            restrictTo={DAM_CLASSES}
            exclude={hog?.id}
            error={errors.dam_id?.message}
            {...register('dam_id')}
          />

          <HogPickerField
            id="hogform-sire"
            label="Sire"
            optional
            includeInactive
            restrictTo={SIRE_CLASSES}
            exclude={hog?.id}
            error={errors.sire_id?.message}
            {...register('sire_id')}
          />
        </div>

        <FormFooter
          submitLabel={isEdit ? 'Save changes' : 'Add hog'}
          isSubmitting={isSubmitting}
          onCancel={close}
        />
      </form>
    </Modal>
  )
}
