/**
 * Server-side access to the FastAPI backend.
 *
 * `API_INTERNAL_URL` is the only environment variable the dashboard reads, and
 * it is deliberately not `NEXT_PUBLIC_*`: the browser never learns the API's
 * address. Every call the browser makes goes to a Next route handler, which
 * then calls the API from the server with the access token attached.
 */
const DEFAULT_API_URL = 'http://127.0.0.1:8000'

export function apiUrl(path: string): string {
  const base = process.env.API_INTERNAL_URL ?? DEFAULT_API_URL
  return `${base.replace(/\/$/, '')}${path}`
}

export function v1(path: string): string {
  return apiUrl(`/api/v1${path}`)
}

/** FastAPI reports errors as `{detail: string}` or, for a 422, a list of
 *  validation objects. Both are flattened to one sentence a person can read. */
export function readDetail(body: unknown, fallback: string): string {
  if (typeof body !== 'object' || body === null) return fallback
  const detail = (body as { detail?: unknown }).detail
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail)) {
    const messages = detail
      .map((entry) =>
        typeof entry === 'object' && entry !== null && 'msg' in entry
          ? String((entry as { msg: unknown }).msg)
          : null,
      )
      .filter((message): message is string => Boolean(message))
    if (messages.length > 0) return messages.join('. ')
  }
  return fallback
}
