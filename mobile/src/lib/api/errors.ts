/**
 * Turning a FastAPI error response into something a person can act on.
 *
 * The backend returns **two different shapes under the same key**:
 *
 *   business rules (400/401/403/404/409):  { "detail": "Hog not found" }
 *   schema violations (422):               { "detail": [ {loc, msg, type} ] }
 *
 * Rendering the second as a string yields `[object Object]`, which is the most
 * common version of this bug and the reason this module exists rather than a
 * one-line `body.detail ?? 'Something went wrong'`.
 */

export const GENERIC_ERROR = 'Something went wrong. Try again.'

/** The message shown when the request never reached the server at all. */
export const OFFLINE_ERROR = 'Could not reach the farm server. Check the connection and try again.'

type ValidationEntry = { loc?: unknown[]; msg?: string }

export class ApiError extends Error {
  readonly status: number
  /**
   * Only populated for 422: field name -> message, ready for react-hook-form's
   * `setError`. On a 5-inch screen the banner at the top of a form may be
   * scrolled out of view, so the message has to be able to reach the input it
   * is about.
   */
  readonly fieldErrors?: Record<string, string>

  constructor(status: number, message: string, fieldErrors?: Record<string, string>) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.fieldErrors = fieldErrors
  }
}

/** `body_weight` -> `Weight`. `loc` is `["body", "weight"]`, so take the tail. */
function fieldNameOf(entry: ValidationEntry): string | null {
  const loc = entry.loc
  if (!Array.isArray(loc) || loc.length === 0) return null
  const last = loc[loc.length - 1]
  return typeof last === 'string' ? last : null
}

function humanizeField(field: string): string {
  const spaced = field.replace(/_/g, ' ')
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}

export function extractError(status: number, body: unknown): ApiError {
  if (body && typeof body === 'object' && 'detail' in body) {
    const detail = (body as { detail: unknown }).detail

    if (typeof detail === 'string' && detail.length > 0) {
      return new ApiError(status, detail)
    }

    if (Array.isArray(detail) && detail.length > 0) {
      const fieldErrors: Record<string, string> = {}
      for (const raw of detail as ValidationEntry[]) {
        const field = fieldNameOf(raw)
        const message = typeof raw?.msg === 'string' ? raw.msg : null
        if (field && message && !(field in fieldErrors)) fieldErrors[field] = message
      }

      const [first] = Object.entries(fieldErrors)
      const message = first ? `${humanizeField(first[0])}: ${first[1]}` : GENERIC_ERROR
      return new ApiError(
        status,
        message,
        Object.keys(fieldErrors).length ? fieldErrors : undefined,
      )
    }
  }

  return new ApiError(status, GENERIC_ERROR)
}

/**
 * A 403 from the lockout path, not the permission path.
 *
 * Both are 403 and both are plausible on the sign-in screen, but they need
 * opposite copy: "you do not have permission" is nonsense after five wrong
 * passwords, and "try again in fifteen minutes" is nonsense on a viewer
 * tapping a manager action. The backend distinguishes them only by the string,
 * so this matches it exactly (`backend/app/api/v1/endpoints/auth.py`).
 */
export const LOCKOUT_DETAIL = 'Account temporarily locked'

export function isLockout(error: unknown): boolean {
  return error instanceof ApiError && error.status === 403 && error.message === LOCKOUT_DETAIL
}

export const LOCKOUT_MESSAGE = 'Too many failed attempts. Try again in about 15 minutes.'

/** The client's own signal that the session could not be renewed. */
export class AuthExpiredError extends ApiError {
  constructor() {
    super(401, 'Your session has expired. Sign in again.')
    this.name = 'AuthExpiredError'
  }
}

/** A message for any thrown value, for the places that just need to say why. */
export function errorMessage(error: unknown): string {
  if (isLockout(error)) return LOCKOUT_MESSAGE
  if (error instanceof ApiError) return error.message
  // A `fetch` that never reached the server rejects with a TypeError whose
  // message ("Network request failed") means nothing to a farm worker.
  if (error instanceof TypeError) return OFFLINE_ERROR
  return GENERIC_ERROR
}
