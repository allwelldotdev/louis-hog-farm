/**
 * Display formatting.
 *
 * Money and dates are formatted against the farm's own `currency_code` and
 * `timezone` from `GET /farms/me`, never a hardcoded locale — the backend went
 * to some trouble to make those per-farm values and the UI should not undo it.
 */

/**
 * What a figure reads as when the backend has nothing to report.
 *
 * A null KPI means "not measured" — no gain recorded, nothing weighed — which
 * is a different claim from zero, and rendering it as `0` would report a herd
 * that gained nothing when the truth is that nobody weighed it.
 */
export const NO_VALUE = '—'

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

/**
 * Today's calendar date at the farm, as `YYYY-MM-DD`.
 *
 * The backend rejects a `record_date` in the future using `farm_today(timezone)`,
 * not UTC. A form that capped its date input at the browser's today would let a
 * worker in Lagos submit a valid same-day entry at 23:30 and watch the API
 * refuse it — the exact off-by-one the backend went to trouble to fix.
 *
 * `en-CA` is the shortest route to ISO order out of `Intl`; the locale is a
 * formatting device here, not a user-facing choice.
 */
export function farmToday(timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

export function formatBusinessDate(
  value: string,
  options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' },
): string {
  return parseBusinessDate(value).toLocaleDateString(undefined, options)
}

export function formatMoney(value: number | null | undefined, currency: string): string {
  if (value === null || value === undefined) return NO_VALUE
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(value)
}

/** Money on a chart axis. A full `NGN 538,270` is wider than the plot area it
 *  labels, and an axis only has to convey magnitude. */
export function formatMoneyCompact(value: number | null | undefined, currency: string): string {
  if (value === null || value === undefined) return NO_VALUE
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value)
}

/** `growth_anomaly` → `Growth anomaly`. The API's enum values are snake_case
 *  identifiers; screens show them to people. */
export function humanize(key: string): string {
  const spaced = key.replace(/_/g, ' ')
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}

export function formatNumber(value: number | null | undefined, fractionDigits = 2): string {
  if (value === null || value === undefined) return NO_VALUE
  return new Intl.NumberFormat(undefined, {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value)
}

export function formatInteger(value: number | null | undefined): string {
  if (value === null || value === undefined) return NO_VALUE
  return new Intl.NumberFormat().format(value)
}

export function formatPercent(value: number | null | undefined, fractionDigits = 1): string {
  if (value === null || value === undefined) return NO_VALUE
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
