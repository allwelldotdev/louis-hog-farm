'use client'

import { Button } from '@/components/ui/button'
import { Field, Select } from '@/components/ui/field'
import { useHogPicker } from '@/hooks/use-hogs'
import type { ProductionClass } from '@/lib/api/types'
import { humanize } from '@/lib/format'

/**
 * The parts every create form on the operational pages repeats.
 *
 * Kept to the two that genuinely recur — the hog picker and the footer — rather
 * than a form abstraction. Five forms with slightly different fields are
 * clearer as five forms; five forms squeezed through one generic renderer are
 * not.
 */

/**
 * A tag picker over the farm's active animals.
 *
 * `restrictTo` exists for breeding: the API rejects a cycle with 400 unless the
 * hog is a sow or gilt, and a picker that offers boars only to have the server
 * refuse the submission is a worse version of the same rule.
 */
export function HogPickerField({
  id,
  label = 'Hog',
  error,
  restrictTo,
  ...props
}: {
  id: string
  label?: string
  error?: string
  restrictTo?: readonly ProductionClass[]
} & React.SelectHTMLAttributes<HTMLSelectElement>) {
  const { options, isPending } = useHogPicker(restrictTo)

  return (
    <Field
      label={label}
      htmlFor={id}
      error={error}
      hint={
        !isPending && options.length === 0
          ? restrictTo
            ? `No active ${restrictTo.map((c) => `${c}s`).join(' or ')} on this farm.`
            : 'No active animals on this farm.'
          : undefined
      }
    >
      <Select id={id} className="h-10 w-full" disabled={isPending} {...props}>
        <option value="">{isPending ? 'Loading…' : 'Select an animal'}</option>
        {options.map((hog) => (
          <option key={hog.id} value={hog.id}>
            {hog.tag_number} · {hog.breed} · {humanize(hog.production_class)}
          </option>
        ))}
      </Select>
    </Field>
  )
}

export function FormFooter({
  submitLabel,
  isSubmitting,
  onCancel,
}: {
  submitLabel: string
  isSubmitting: boolean
  onCancel: () => void
}) {
  return (
    <div className="flex justify-end gap-2 pt-2">
      <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
        Cancel
      </Button>
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Saving…' : submitLabel}
      </Button>
    </div>
  )
}
