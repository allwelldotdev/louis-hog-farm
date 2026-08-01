import { describe, expect, it } from 'vitest'

import {
  ApiError,
  GENERIC_ERROR,
  LOCKOUT_DETAIL,
  LOCKOUT_MESSAGE,
  OFFLINE_ERROR,
  errorMessage,
  extractError,
  isLockout,
} from './errors'

describe('extractError', () => {
  it('reads a business error straight out of detail', () => {
    const error = extractError(409, { detail: 'An active hog with this tag number already exists' })
    expect(error.status).toBe(409)
    expect(error.message).toBe('An active hog with this tag number already exists')
    expect(error.fieldErrors).toBeUndefined()
  })

  it('never renders a 422 detail array as [object Object]', () => {
    const error = extractError(422, {
      detail: [
        { loc: ['body', 'weight'], msg: 'Input should be greater than 0', type: 'greater_than' },
        { loc: ['body', 'record_date'], msg: 'Field required', type: 'missing' },
      ],
    })
    expect(error.message).not.toContain('[object Object]')
    expect(error.message).toBe('Weight: Input should be greater than 0')
  })

  it('maps 422 entries to field errors for setError', () => {
    const error = extractError(422, {
      detail: [
        { loc: ['body', 'weight'], msg: 'Input should be greater than 0' },
        { loc: ['body', 'vaccine_name'], msg: 'Field required' },
      ],
    })
    expect(error.fieldErrors).toEqual({
      weight: 'Input should be greater than 0',
      vaccine_name: 'Field required',
    })
  })

  it('keeps the first message when a field reports twice', () => {
    const error = extractError(422, {
      detail: [
        { loc: ['body', 'weight'], msg: 'first' },
        { loc: ['body', 'weight'], msg: 'second' },
      ],
    })
    expect(error.fieldErrors).toEqual({ weight: 'first' })
  })

  it('falls back for shapes it does not recognise', () => {
    for (const body of [null, undefined, {}, { detail: [] }, { detail: 42 }, 'plain text']) {
      expect(extractError(500, body).message).toBe(GENERIC_ERROR)
    }
  })

  it('survives a 422 entry with no usable loc', () => {
    const error = extractError(422, { detail: [{ msg: 'something' }] })
    expect(error.message).toBe(GENERIC_ERROR)
    expect(error.fieldErrors).toBeUndefined()
  })
})

describe('isLockout', () => {
  it('recognises only the backend’s exact lockout string', () => {
    expect(isLockout(new ApiError(403, LOCKOUT_DETAIL))).toBe(true)
  })

  it('does not mistake a permission denial for a lockout', () => {
    // Both are 403. Confusing them puts "try again in 15 minutes" in front of
    // a viewer who tapped a manager action.
    expect(isLockout(new ApiError(403, 'Not permitted'))).toBe(false)
    expect(isLockout(new ApiError(401, LOCKOUT_DETAIL))).toBe(false)
    expect(isLockout(new Error(LOCKOUT_DETAIL))).toBe(false)
  })
})

describe('errorMessage', () => {
  it('rewrites a lockout into something actionable', () => {
    expect(errorMessage(new ApiError(403, LOCKOUT_DETAIL))).toBe(LOCKOUT_MESSAGE)
  })

  it('explains a failed fetch in farm terms, not in TypeError terms', () => {
    expect(errorMessage(new TypeError('Network request failed'))).toBe(OFFLINE_ERROR)
  })

  it('passes an ordinary API message through', () => {
    expect(errorMessage(new ApiError(400, 'record_date cannot be in the future'))).toBe(
      'record_date cannot be in the future',
    )
  })

  it('has an answer for anything at all', () => {
    expect(errorMessage(undefined)).toBe(GENERIC_ERROR)
    expect(errorMessage('nope')).toBe(GENERIC_ERROR)
  })
})
