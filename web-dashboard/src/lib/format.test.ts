import { describe, expect, it } from 'vitest'

import {
  NO_VALUE,
  formatBusinessDate,
  formatInteger,
  formatMoney,
  formatNumber,
  formatPercent,
  formatRelative,
  parseBusinessDate,
} from './format'

describe('parseBusinessDate', () => {
  /**
   * The whole reason this function exists. `new Date('2026-07-30')` is parsed as
   * UTC midnight, so west of Greenwich it renders as the 29th and shifts an
   * entire chart series by a day. A business date is a calendar fact with no
   * instant attached and has to be built component-wise.
   */
  it('is local midnight, not UTC midnight', () => {
    const parsed = parseBusinessDate('2026-07-30')

    expect(parsed.getFullYear()).toBe(2026)
    expect(parsed.getMonth()).toBe(6)
    expect(parsed.getDate()).toBe(30)
    expect(parsed.getHours()).toBe(0)
  })

  it('keeps the calendar day the API sent', () => {
    expect(formatBusinessDate('2026-01-01', { dateStyle: 'medium' })).toContain('2026')
    expect(parseBusinessDate('2026-01-01').getDate()).toBe(1)
  })
})

describe('null figures', () => {
  /**
   * A null KPI means "not measured" — no animal weighed twice, nothing to
   * divide by. Rendering it as 0 would report a herd that gained nothing, which
   * is a different and false claim.
   */
  it('renders as a dash rather than zero', () => {
    expect(formatNumber(null)).toBe(NO_VALUE)
    expect(formatInteger(null)).toBe(NO_VALUE)
    expect(formatPercent(null)).toBe(NO_VALUE)
    expect(formatMoney(null, 'NGN')).toBe(NO_VALUE)
    expect(formatNumber(undefined)).toBe(NO_VALUE)
  })

  it('still renders a real zero as zero', () => {
    expect(formatNumber(0, 0)).toBe('0')
    expect(formatPercent(0)).toBe('0.0%')
    expect(formatInteger(0)).toBe('0')
  })
})

describe('formatMoney', () => {
  it('formats against the farm currency it is given', () => {
    const naira = formatMoney(8921153.52, 'NGN')

    expect(naira).toMatch(/8[,.\s]?921[,.\s]?154|8[,.\s]?921[,.\s]?153/)
    expect(naira).not.toBe(NO_VALUE)
  })
})

describe('formatRelative', () => {
  const now = new Date('2026-07-30T12:00:00Z')

  it('describes the recent past in the nearest sensible unit', () => {
    expect(formatRelative(new Date('2026-07-30T11:59:30Z'), now)).toMatch(/second/)
    expect(formatRelative(new Date('2026-07-30T11:45:00Z'), now)).toMatch(/minute/)
    expect(formatRelative(new Date('2026-07-30T09:00:00Z'), now)).toMatch(/hour/)
    expect(formatRelative(new Date('2026-07-28T12:00:00Z'), now)).toMatch(/day/)
  })
})
