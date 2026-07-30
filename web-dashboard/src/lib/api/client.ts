/**
 * Browser-side API access.
 *
 * Everything goes to `/api/backend/...` on the Next server, which attaches the
 * access token and forwards to FastAPI. There is no base URL to configure and
 * no token to attach here, by design.
 */

export class ApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

function withQuery(path: string, params?: Record<string, string | number | undefined>): string {
  if (!params) return path
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') search.set(key, String(value))
  }
  const query = search.toString()
  return query ? `${path}?${query}` : path
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/backend${path}`, {
    ...init,
    headers: { accept: 'application/json', ...init?.headers },
  })

  if (!response.ok) {
    const body = await response.json().catch(() => null)
    const message =
      (body && typeof body === 'object' && 'error' in body && String(body.error)) ||
      (body && typeof body === 'object' && 'detail' in body && String(body.detail)) ||
      'Something went wrong. Try again.'
    throw new ApiError(response.status, message)
  }

  return (await response.json()) as T
}

export function apiGet<T>(
  path: string,
  params?: Record<string, string | number | undefined>,
): Promise<T> {
  return request<T>(withQuery(path, params))
}

export function apiSend<T>(
  method: 'POST' | 'PATCH' | 'PUT' | 'DELETE',
  path: string,
  body?: unknown,
): Promise<T> {
  return request<T>(path, {
    method,
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}
