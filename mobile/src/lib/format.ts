/**
 * Display formatting.
 *
 * A trimmed port of `web-dashboard/src/lib/format.ts`, plus `toNumber`, which
 * the web does not need. Two deliberate divergences from the web version:
 *
 *  - No `Intl.NumberFormat(style: 'currency')`. Hermes on Android ships a
 *    reduced ICU, and currency formatting is the first thing to degrade. Money
 *    is rendered as `<code> <number>` by `formatMoney` instead, which is also
 *    honest about the farm's `currency_code` rather than guessing a symbol.
 *  - `farmToday` exists but is a *fallback*. The authoritative value is
 *    `date_to` from `GET /dashboard/kpis`, which the server already computes in
 *    the farm's timezone. See `src/hooks/use-farm-today.ts`.
 */

/**
 * What a figure reads as when the backend has nothing to report.
 *
 * A null KPI means "not measured" — nothing weighed, no gain recorded — which
 * is a different claim from zero, and rendering it as `0` would report a herd
 * that gained nothing when the truth is that nobody weighed it.
 */
export const NO_VALUE = '—'

/**
 * Coerce an API numeric into a real number.
 *
 * Pydantic v2 serialises `Decimal` as a JSON **string**, so the same quantity
 * arrives typed differently depending on the endpoint:
 *
 *   GET /health-records  -> weight: "48.200"      (string)
 *   GET /feed-records    -> feed_cost: "1200.00"  (string)
 *   GET /hogs/{id}/growth-> weight_kg: 48.2       (number, it is a float)
 *   GET /dashboard/kpis  -> avg_daily_gain_kg: .42 (number)
 *
 * Every read site must go through here. `"48.200".toFixed(1)` throws, and
 * `a.weight - b.weight` over strings is `NaN` — both silently, at runtime, on
 * a phone in a barn.
 */
export function toNumber(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

/**
 * Parse a `YYYY-MM-DD` business date as local midnight.
 *
 * `new Date('2026-07-30')` parses bare ISO dates as **UTC** midnight, so at any
 * negative offset the date renders as the 29th and a series shifts by a whole
 * day. Every `*_date` field from the API is a calendar fact with no instant
 * attached, so it must be built component-wise.
 */
export function parseBusinessDate(value: string): Date {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day)
}

/** A `Date` back to the `YYYY-MM-DD` the API expects. */
export function toBusinessDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

/** `2026-08-01` -> `2026-07-31`. Used by the capture forms' "Yesterday" chip. */
export function addDays(value: string, days: number): string {
  const date = parseBusinessDate(value)
  date.setDate(date.getDate() + days)
  return toBusinessDate(date)
}

/**
 * Today's calendar date on the *device*, as `YYYY-MM-DD`.
 *
 * Only a fallback for before the first KPI response lands. The backend rejects
 * a future `record_date` against `farm_today(farm.timezone)`, not the device
 * clock — and a shared barn phone is not a trustworthy clock. Prefer the
 * server's own answer wherever it is available.
 */
export function deviceToday(): string {
  return toBusinessDate(new Date())
}

export function isFutureDate(value: string, today: string): boolean {
  return value > today
}

export function formatBusinessDate(
  value: string,
  options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' },
): string {
  return parseBusinessDate(value).toLocaleDateString(undefined, options)
}

/** `growth_anomaly` -> `Growth anomaly`. The API's enum values are snake_case
 *  identifiers; screens show them to people. */
export function humanize(key: string): string {
  const spaced = key.replace(/_/g, ' ')
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}

export function formatNumber(
  value: string | number | null | undefined,
  fractionDigits = 2,
): string {
  const parsed = toNumber(value)
  if (parsed === null) return NO_VALUE
  return parsed.toFixed(fractionDigits)
}

export function formatInteger(value: string | number | null | undefined): string {
  const parsed = toNumber(value)
  if (parsed === null) return NO_VALUE
  return String(Math.round(parsed))
}

export function formatPercent(
  value: string | number | null | undefined,
  fractionDigits = 1,
): string {
  const parsed = toNumber(value)
  if (parsed === null) return NO_VALUE
  return `${parsed.toFixed(fractionDigits)}%`
}

/** `NGN 1,200`. See the note at the top on why this is not `Intl` currency. */
export function formatMoney(value: string | number | null | undefined, currency: string): string {
  const parsed = toNumber(value)
  if (parsed === null) return NO_VALUE
  return `${currency} ${parsed.toFixed(2)}`
}

/**
 * Accept what a decimal keypad can actually produce.
 *
 * A device set to a comma decimal separator emits `48,2`. Sent as-is that is
 * either a 422 or, worse, a truncated number.
 */
export function normaliseDecimalInput(value: string): string {
  return value.trim().replace(',', '.')
}
