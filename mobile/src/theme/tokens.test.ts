import { describe, expect, it } from 'vitest'

import { dark, light, type Palette } from './tokens'

// globals.css states these invariants in a comment and nothing enforces them.
// A divergence is invisible until someone opens the other theme, which on a
// phone might be weeks later.
describe('palette invariants', () => {
  const themes: [string, Palette][] = [
    ['dark', dark],
    ['light', light],
  ]

  it.each(themes)('%s: chart1 is the accent and chart3 is the gain colour', (_name, palette) => {
    expect(palette.chart1).toBe(palette.ochre)
    expect(palette.chart3).toBe(palette.gain)
  })

  it('defines exactly the same tokens in both themes', () => {
    expect(Object.keys(dark).sort()).toEqual(Object.keys(light).sort())
  })

  it('gives every token a distinct value per theme', () => {
    // A token accidentally copied across from the other palette would render
    // as a hole in the page in one theme and go unnoticed in the other.
    for (const key of Object.keys(dark) as (keyof Palette)[]) {
      expect(dark[key], `${key} is identical in both themes`).not.toBe(light[key])
    }
  })

  it('uses colour values React Native can parse', () => {
    for (const palette of [dark, light]) {
      for (const [key, value] of Object.entries(palette)) {
        expect(value, `${key} is not a hex or legacy rgba value`).toMatch(
          /^(#[0-9a-f]{6}|rgba\(\d+, \d+, \d+, [\d.]+\))$/,
        )
      }
    }
  })
})
