/**
 * Display formatting.
 *
 * Money and dates are formatted against the farm's own `currency_code` and
 * `timezone` from `GET /farms/me`, never a hardcoded locale — the backend went
 * to some trouble to make those per-farm values and the UI should not undo it.
 */

/**
 * Parse a `YYYY-MM-DD` business date as local midnight.
 *
 * `new Date('2026-07-30')` parses bare ISO dates as **UTC** midnight, so at any
 * negative offset `toLocaleDateString()` renders the 29th and a chart series
 * silently shifts by a whole day. Every `*_date` field from the API is a
 * calendar fact with no instant attached, so it must be built component-wise.
 */
export function parseBusinessDate(value: string): Date {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day)
}

export function formatBusinessDate(
  value: string,
  options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' },
): string {
  return parseBusinessDate(value).toLocaleDateString(undefined, options)
}

export function formatMoney(value: number | null | undefined, currency: string): string {
  if (value === null || value === undefined) return '—'
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(value)
}

export function formatNumber(value: number | null | undefined, fractionDigits = 2): string {
  if (value === null || value === undefined) return '—'
  return new Intl.NumberFormat(undefined, {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value)
}

export function formatInteger(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—'
  return new Intl.NumberFormat().format(value)
}

export function formatPercent(value: number | null | undefined, fractionDigits = 1): string {
  if (value === null || value === undefined) return '—'
  return `${value.toFixed(fractionDigits)}%`
}

/** "Updated 4 minutes ago" — the footer every refreshable card carries. */
export function formatRelative(from: Date, now: Date = new Date()): string {
  const seconds = Math.round((from.getTime() - now.getTime()) / 1000)
  const formatter = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' })
  const thresholds: [number, Intl.RelativeTimeFormatUnit][] = [
    [60, 'second'],
    [3600, 'minute'],
    [86400, 'hour'],
  ]
  for (const [limit, unit] of thresholds) {
    if (Math.abs(seconds) < limit) {
      const divisor = limit === 60 ? 1 : limit === 3600 ? 60 : 3600
      return formatter.format(Math.round(seconds / divisor), unit)
    }
  }
  return formatter.format(Math.round(seconds / 86400), 'day')
}
