'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'

import { FormFooter } from '@/components/forms/form-parts'
import { Field, Input, Select } from '@/components/ui/field'
import { Modal } from '@/components/ui/modal'
import { useCreateUser } from '@/hooks/use-users'
import { ApiError } from '@/lib/api/client'
import type { UserRole } from '@/lib/api/types'
import { ROLE_LABELS, STAFF_ROLES } from '@/lib/auth/permissions'

/**
 * A sign-on for a colleague.
 *
 * The password rules are duplicated from the backend's `password_complexity`
 * validator on purpose: FastAPI answers a 422 with `detail` as an array of
 * error objects, and `lib/api/client.ts` stringifies it — so a too-short
 * password would surface as unreadable text unless the form catches it first.
 * Every other create form in the app mirrors its server rule for the same
 * reason.
 */
const schema = z.object({
  full_name: z.string().min(1, 'Give the account a name').max(255),
  email: z.email('Enter a valid email address'),
  password: z
    .string()
    .min(8, 'At least 8 characters')
    .max(128)
    .refine(
      (v) => /[A-Za-z]/.test(v) && /\d/.test(v),
      'Include at least one letter and one number',
    ),
  role: z.string().min(1),
})

type FormValues = z.input<typeof schema>

export function StaffForm({ open, onClose }: { open: boolean; onClose: () => void }) {
  const create = useCreateUser()

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { full_name: '', email: '', password: '', role: 'worker' },
  })

  const close = () => {
    reset()
    onClose()
  }

  const onSubmit = handleSubmit(async (values) => {
    try {
      await create.mutateAsync({
        full_name: values.full_name.trim(),
        email: values.email.trim(),
        password: values.password,
        role: values.role as UserRole,
      })
      toast.success('Account created')
      close()
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Could not create the account.')
    }
  })

  return (
    <Modal
      open={open}
      onClose={close}
      title="Add a staff account"
      description="The account joins this farm. Managers are not created from here."
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <Field label="Full name" htmlFor="staff-name" error={errors.full_name?.message}>
          <Input id="staff-name" placeholder="Ada Okafor" {...register('full_name')} />
        </Field>

        <Field label="Email" htmlFor="staff-email" error={errors.email?.message}>
          <Input
            id="staff-email"
            type="email"
            autoComplete="off"
            placeholder="ada@brightacres.com"
            {...register('email')}
          />
        </Field>

        <Field
          label="Password"
          htmlFor="staff-password"
          error={errors.password?.message}
          hint="At least 8 characters, with a letter and a number."
        >
          <Input
            id="staff-password"
            type="password"
            autoComplete="new-password"
            {...register('password')}
          />
        </Field>

        <Field
          label="Role"
          htmlFor="staff-role"
          error={errors.role?.message}
          hint="A worker can record data; a viewer can only read it."
        >
          <Select id="staff-role" className="h-10 w-full" {...register('role')}>
            {STAFF_ROLES.map((value) => (
              <option key={value} value={value}>
                {ROLE_LABELS[value]}
              </option>
            ))}
          </Select>
        </Field>

        <FormFooter submitLabel="Create account" isSubmitting={isSubmitting} onCancel={close} />
      </form>
    </Modal>
  )
}
