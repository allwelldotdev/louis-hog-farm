import { describe, expect, it } from 'vitest'

import { canManage, canWrite } from '@/lib/auth/permissions'

/**
 * The demo login is a manager, so every screenshot and every manual pass
 * exercises the permissive branch. These are the only place the restrictive
 * ones are checked.
 */
describe('permissions', () => {
  it('denies everything while the role is still unknown', () => {
    expect(canWrite(undefined)).toBe(false)
    expect(canManage(undefined)).toBe(false)
  })

  it('lets workers write but not manage', () => {
    expect(canWrite('worker')).toBe(true)
    expect(canManage('worker')).toBe(false)
  })

  it('denies viewers both', () => {
    expect(canWrite('viewer')).toBe(false)
    expect(canManage('viewer')).toBe(false)
  })

  it('grants managers and admins both', () => {
    for (const role of ['manager', 'admin'] as const) {
      expect(canWrite(role)).toBe(true)
      expect(canManage(role)).toBe(true)
    }
  })
})
