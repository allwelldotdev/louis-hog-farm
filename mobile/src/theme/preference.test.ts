import { describe, expect, it } from 'vitest'

import {
  DEFAULT_THEME,
  THEME_CYCLE,
  THEME_STORAGE_KEY,
  readPreference,
  readSystemScheme,
  resolveTheme,
  writePreference,
  type ThemePreference,
} from './preference'

describe('storage contract', () => {
  it('uses the same key as the dashboard', () => {
    // Not cosmetic: it is what lets a reader reason about either client from
    // the other. Changing it here silently forks the contract.
    expect(THEME_STORAGE_KEY).toBe('bright-acres:theme')
  })

  it('treats an absent key as system, never as a theme', () => {
    expect(readPreference(null)).toBe('system')
    expect(readPreference(undefined)).toBe('system')
  })

  it('reads back the only two values it ever writes', () => {
    expect(readPreference('light')).toBe('light')
    expect(readPreference('dark')).toBe('dark')
  })

  it('falls back to system for anything it did not write', () => {
    // Includes the literal 'system', which must never be persisted — if it
    // ever appears in storage it came from a different implementation.
    expect(readPreference('system')).toBe('system')
    expect(readPreference('')).toBe('system')
    expect(readPreference('sepia')).toBe('system')
  })

  it('persists system as a deletion', () => {
    expect(writePreference('system')).toBeNull()
    expect(writePreference('light')).toBe('light')
    expect(writePreference('dark')).toBe('dark')
  })

  it('round-trips every preference', () => {
    for (const preference of ['system', 'light', 'dark'] as const) {
      expect(readPreference(writePreference(preference))).toBe(preference)
    }
  })
})

describe('resolveTheme', () => {
  it('lets an explicit preference override the OS', () => {
    expect(resolveTheme('light', 'dark')).toBe('light')
    expect(resolveTheme('dark', 'light')).toBe('dark')
  })

  it('follows the OS when the preference is system', () => {
    expect(resolveTheme('system', 'light')).toBe('light')
    expect(resolveTheme('system', 'dark')).toBe('dark')
  })

  it('defaults to dark when the OS reports nothing', () => {
    // Appearance.getColorScheme() returns null on Android unless app.json sets
    // userInterfaceStyle: "automatic". Dark is the web's default too.
    expect(DEFAULT_THEME).toBe('dark')
    expect(resolveTheme('system', null)).toBe('dark')
    expect(resolveTheme('system', undefined)).toBe('dark')
  })
})

describe('readSystemScheme', () => {
  it('passes the two real schemes through', () => {
    expect(readSystemScheme('light')).toBe('light')
    expect(readSystemScheme('dark')).toBe('dark')
  })

  it("treats Appearance's 'unspecified' as no answer, not as a theme", () => {
    // ColorSchemeName includes 'unspecified', which is what an Android device
    // with no system-wide setting reports. It must fall through to the
    // default rather than being coerced into one of the two themes.
    expect(readSystemScheme('unspecified')).toBeNull()
    expect(readSystemScheme(null)).toBeNull()
    expect(readSystemScheme(undefined)).toBeNull()
  })
})

describe('THEME_CYCLE', () => {
  it('returns to the start in exactly three steps', () => {
    let preference: ThemePreference = 'system'
    const seen: ThemePreference[] = [preference]
    for (let i = 0; i < 3; i += 1) {
      preference = THEME_CYCLE[preference]
      seen.push(preference)
    }
    expect(seen).toEqual(['system', 'light', 'dark', 'system'])
  })
})
