import type { FieldValues, Path, UseFormSetError } from 'react-hook-form'

import { ApiError } from '@/lib/api/errors'

/**
 * Push a 422's per-field messages onto the inputs they belong to.
 *
 * The banner at the top of a capture form can be scrolled out of view on a
 * 5-inch screen, so a validation failure that only appears there is a message
 * the user has to hunt for. `extractError` already mapped `loc` to field names;
 * this puts them where they are read.
 *
 * Fields the form does not have are ignored rather than dropped on the floor —
 * the banner still carries the first message, so nothing goes unreported.
 */
export function applyFieldErrors<T extends FieldValues>(
  cause: unknown,
  setError: UseFormSetError<T>,
  known: readonly Path<T>[],
): void {
  if (!(cause instanceof ApiError) || !cause.fieldErrors) return
  for (const [field, message] of Object.entries(cause.fieldErrors)) {
    if ((known as readonly string[]).includes(field)) {
      setError(field as Path<T>, { type: 'server', message })
    }
  }
}
