import { describe, expect, it } from 'vitest'

import { STAFF_ROLES, canChangeRoleOf, canManage, canWrite } from './permissions'

describe('canWrite — mirrors require_not_viewer', () => {
  it('lets every role but viewer write', () => {
    expect(canWrite('manager')).toBe(true)
    expect(canWrite('admin')).toBe(true)
    expect(canWrite('worker')).toBe(true)
    expect(canWrite('viewer')).toBe(false)
  })

  it('denies while the role is still unknown', () => {
    // The whole point: no write affordance may flash during /users/me.
    expect(canWrite(undefined)).toBe(false)
  })
})

describe('canManage — mirrors require_manager', () => {
  it('admits manager and admin only', () => {
    expect(canManage('manager')).toBe(true)
    expect(canManage('admin')).toBe(true)
    expect(canManage('worker')).toBe(false)
    expect(canManage('viewer')).toBe(false)
    expect(canManage(undefined)).toBe(false)
  })
})

describe('STAFF_ROLES', () => {
  it('offers only what POST /users accepts', () => {
    // The API answers "Role must be worker or viewer"; offering anything else
    // would be a select whose options the server rejects.
    expect([...STAFF_ROLES]).toEqual(['worker', 'viewer'])
  })
})

describe('canChangeRoleOf', () => {
  it('refuses your own row', () => {
    expect(canChangeRoleOf({ id: 1, role: 'worker' }, 1)).toBe(false)
  })

  it('refuses another manager or admin', () => {
    // Nothing in the app can promote anyone back to manager, so a demotion
    // would be a one-way door out of the settings page.
    expect(canChangeRoleOf({ id: 2, role: 'manager' }, 1)).toBe(false)
    expect(canChangeRoleOf({ id: 3, role: 'admin' }, 1)).toBe(false)
  })

  it('allows a colleague who is a worker or viewer', () => {
    expect(canChangeRoleOf({ id: 2, role: 'worker' }, 1)).toBe(true)
    expect(canChangeRoleOf({ id: 3, role: 'viewer' }, 1)).toBe(true)
  })
})
