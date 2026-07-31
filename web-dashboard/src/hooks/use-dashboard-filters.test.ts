import { describe, expect, it } from 'vitest'

import { toQueryParams } from './use-dashboard-filters'

describe('toQueryParams', () => {
  const filters = { dateFrom: '2026-05-01', dateTo: '2026-07-31', breed: 'Berkshire' }

  it('sends an endpoint only the parameters it declares', () => {
    // `/dashboard/weight-distribution` is a histogram of each hog's *latest*
    // weight, so it takes no start date. Sending one anyway would be ignored by
    // the API but would still split its cache key, producing a second cached
    // copy of an identical response for every distinct date_from.
    expect(toQueryParams(filters, ['date_to', 'breed'])).toEqual({
      date_to: '2026-07-31',
      breed: 'Berkshire',
    })
  })

  it('keeps unset filters as undefined rather than empty strings', () => {
    // `?breed=` would be read by the API as a breed named the empty string.
    expect(toQueryParams({}, ['date_from', 'date_to', 'breed'])).toEqual({
      date_from: undefined,
      date_to: undefined,
      breed: undefined,
    })
  })

  it('maps the hog facets to their API spelling', () => {
    // `productionClass` is the only filter whose camelCase name differs from
    // the API's, which makes it the one that can silently stop filtering.
    expect(
      toQueryParams({ status: 'archived', productionClass: 'sow' }, ['status', 'production_class']),
    ).toEqual({ status: 'archived', production_class: 'sow' })
  })

  it('uses the API spelling of each parameter', () => {
    expect(Object.keys(toQueryParams(filters, ['date_from', 'date_to', 'breed']))).toEqual([
      'date_from',
      'date_to',
      'breed',
    ])
  })
})
