'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'

import { FormFooter } from '@/components/forms/form-parts'
import { Field, Input } from '@/components/ui/field'
import { Modal } from '@/components/ui/modal'
import { useUpdateFarm } from '@/hooks/use-farm'
import { ApiError } from '@/lib/api/client'

const schema = z.object({
  name: z.string().min(1, 'The farm needs a name').max(255),
})

type FormValues = z.input<typeof schema>

export function FarmForm({
  open,
  onClose,
  name,
}: {
  open: boolean
  onClose: () => void
  name: string
}) {
  const update = useUpdateFarm()

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema), values: { name } })

  const close = () => {
    reset()
    onClose()
  }

  const onSubmit = handleSubmit(async (values) => {
    try {
      await update.mutateAsync({ name: values.name.trim() })
      toast.success('Farm renamed')
      close()
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Could not rename the farm.')
    }
  })

  return (
    <Modal
      open={open}
      onClose={close}
      title="Rename the farm"
      description="Currency and timezone are set per deployment and are not editable here."
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <Field label="Name" htmlFor="farm-name" error={errors.name?.message}>
          <Input id="farm-name" {...register('name')} />
        </Field>

        <FormFooter submitLabel="Save name" isSubmitting={isSubmitting} onCancel={close} />
      </form>
    </Modal>
  )
}
