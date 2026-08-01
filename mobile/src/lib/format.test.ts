import { describe, expect, it } from 'vitest'

import {
  NO_VALUE,
  addDays,
  formatInteger,
  formatMoney,
  formatNumber,
  isFutureDate,
  normaliseDecimalInput,
  parseBusinessDate,
  toBusinessDate,
  toNumber,
} from './format'

describe('toNumber', () => {
  // The whole point of this helper: Pydantic serialises Decimal as a string,
  // so record endpoints hand back "48.200" where /growth hands back 48.2.
  it('parses the Decimal strings the record endpoints return', () => {
    expect(toNumber('48.200')).toBe(48.2)
    expect(toNumber('1200.00')).toBe(1200)
    expect(toNumber('0')).toBe(0)
  })

  it('passes real numbers through', () => {
    expect(toNumber(48.2)).toBe(48.2)
    expect(toNumber(0)).toBe(0)
  })

  it('maps every absent or unparseable value to null, never 0', () => {
    expect(toNumber(null)).toBeNull()
    expect(toNumber(undefined)).toBeNull()
    expect(toNumber('')).toBeNull()
    expect(toNumber('not a number')).toBeNull()
    expect(toNumber(Number.NaN)).toBeNull()
    expect(toNumber(Number.POSITIVE_INFINITY)).toBeNull()
  })
})

describe('business dates', () => {
  // `new Date('2026-07-30')` is UTC midnight, which renders as the 29th at any
  // negative offset. Component-wise construction is the fix.
  it('parses YYYY-MM-DD as local midnight, not UTC', () => {
    const date = parseBusinessDate('2026-07-30')
    expect(date.getFullYear()).toBe(2026)
    expect(date.getMonth()).toBe(6)
    expect(date.getDate()).toBe(30)
    expect(date.getHours()).toBe(0)
  })

  it('round-trips through toBusinessDate with zero padding', () => {
    expect(toBusinessDate(new Date(2026, 0, 5))).toBe('2026-01-05')
    expect(toBusinessDate(parseBusinessDate('2026-08-01'))).toBe('2026-08-01')
  })

  it('steps across month and year boundaries', () => {
    expect(addDays('2026-08-01', -1)).toBe('2026-07-31')
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31')
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01')
  })

  it('compares dates lexically, which is safe for zero-padded ISO', () => {
    expect(isFutureDate('2026-08-02', '2026-08-01')).toBe(true)
    expect(isFutureDate('2026-08-01', '2026-08-01')).toBe(false)
    expect(isFutureDate('2026-07-31', '2026-08-01')).toBe(false)
  })
})

describe('formatters', () => {
  it('renders an absent figure as the em dash, not zero', () => {
    expect(formatNumber(null)).toBe(NO_VALUE)
    expect(formatInteger(undefined)).toBe(NO_VALUE)
    expect(formatMoney(null, 'NGN')).toBe(NO_VALUE)
  })

  it('formats Decimal strings without the caller parsing first', () => {
    expect(formatNumber('48.200', 1)).toBe('48.2')
    expect(formatInteger('61')).toBe('61')
    expect(formatMoney('1200.00', 'NGN')).toBe('NGN 1200.00')
  })

  it('keeps a real zero distinct from a missing value', () => {
    expect(formatNumber(0, 1)).toBe('0.0')
    expect(formatInteger(0)).toBe('0')
  })
})

describe('normaliseDecimalInput', () => {
  it('accepts the comma a European keypad produces', () => {
    expect(normaliseDecimalInput('48,2')).toBe('48.2')
    expect(normaliseDecimalInput(' 48.2 ')).toBe('48.2')
  })
})
