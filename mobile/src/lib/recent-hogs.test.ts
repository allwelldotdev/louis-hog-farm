import { describe, expect, it } from 'vitest'

import { RECENT_HOGS_LIMIT, parseRecent, pushRecent } from './recent-hogs'

describe('pushRecent', () => {
  it('puts the newest first', () => {
    expect(pushRecent([2, 3], 1)).toEqual([1, 2, 3])
  })

  it('moves a repeat to the front rather than duplicating it', () => {
    // Weighing a pen means touching the same tags repeatedly; a list that
    // filled up with one animal would be useless.
    expect(pushRecent([1, 2, 3], 2)).toEqual([2, 1, 3])
  })

  it('caps the list', () => {
    const ids = pushRecent([1, 2, 3, 4, 5], 6)
    expect(ids).toHaveLength(RECENT_HOGS_LIMIT)
    expect(ids).toEqual([6, 1, 2, 3, 4])
  })

  it('starts from empty', () => {
    expect(pushRecent([], 7)).toEqual([7])
  })
})

describe('parseRecent', () => {
  it('reads back what was written', () => {
    expect(parseRecent(JSON.stringify([3, 1, 2]))).toEqual([3, 1, 2])
  })

  it('returns empty for anything unusable rather than throwing', () => {
    for (const raw of [null, undefined, '', 'not json', '{}', '"a string"']) {
      expect(parseRecent(raw)).toEqual([])
    }
  })

  it('drops entries that are not ids', () => {
    expect(parseRecent(JSON.stringify([1, 'two', null, 3, {}]))).toEqual([1, 3])
  })
})
