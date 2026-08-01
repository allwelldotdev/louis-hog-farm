/**
 * Design tokens — ported verbatim from `web-dashboard/src/app/globals.css`.
 *
 * The dashboard keeps one token set and swaps CSS variables, so no component
 * there knows which theme it is in. React Native has no CSS variables, so the
 * same idea becomes two frozen objects behind a context: components read
 * `colors.x` and stay equally ignorant.
 *
 * These values are a copy, not a fork. If a colour changes in `globals.css` it
 * must change here in the same edit, or the two clients of one API start
 * looking like two products.
 */

export type Palette = {
  /** Page background. */
  ground: string
  /** Card / panel background. */
  surface: string
  /** One step off the card: inputs, row press states, skeletons. */
  raised: string
  /** Hairline border. */
  rule: string
  /** Hover/pressed border. */
  ruleStrong: string
  /** Secondary text. */
  muted: string
  /** Primary text. */
  ink: string
  /** Text sitting on a solid accent fill. */
  onAccent: string

  /** The one accent, carrying every piece of live data. */
  ochre: string
  ochreDim: string
  /** Success / "gaining". */
  gain: string
  /** Everything bad — error, danger, overdue. There is no separate warn. */
  alert: string

  /** Badge grounds. Opaque, not alpha — see the note in globals.css. */
  ochreWash: string
  gainWash: string
  alertWash: string

  /** Modal backdrop. */
  scrim: string

  /** chart1 must equal ochre and chart3 must equal gain, in both themes. */
  chart1: string
  chart2: string
  chart3: string
  chart4: string
  chart5: string
}

/** Dark: a control room after dark. The default, as on the web. */
export const dark: Palette = Object.freeze({
  ground: '#0e1116',
  surface: '#151a21',
  raised: '#1c222b',
  rule: '#232a34',
  ruleStrong: '#313a47',
  muted: '#8a96a6',
  ink: '#e8eaed',
  onAccent: '#0e1116',

  ochre: '#c8873b',
  ochreDim: '#8a5d28',
  gain: '#6e9c6b',
  alert: '#d06a5d',

  ochreWash: '#2a2118',
  gainWash: '#1e2a26',
  alertWash: '#291d1c',

  // globals.css writes this as `rgb(5 7 10 / 0.72)`. React Native's colour
  // parser predates that syntax on some versions; the legacy form is
  // unambiguous everywhere and identical in value.
  scrim: 'rgba(5, 7, 10, 0.72)',

  chart1: '#c8873b',
  chart2: '#7c9bb5',
  chart3: '#6e9c6b',
  chart4: '#b5766b',
  chart5: '#9184ad',
})

/** Light: the same room in daylight. Warm, low chroma, never white. */
export const light: Palette = Object.freeze({
  ground: '#f4e9e4',
  surface: '#fdf6f3',
  // Inverts relative to dark — in light this is a *tint*, because lighter than
  // #fdf6f3 is white and white is glare. Every consumer wants "a step away
  // from the card" and the direction is irrelevant to all of them.
  raised: '#ede1da',
  rule: '#e4d3ca',
  ruleStrong: '#cbb4a9',
  muted: '#6f5f59',
  ink: '#241b18',
  onAccent: '#fdf8f6',

  ochre: '#8a5613',
  ochreDim: '#eccfa8',
  gain: '#42663f',
  alert: '#9c3728',

  ochreWash: '#f7e6cd',
  gainWash: '#dee9da',
  alertWash: '#fadcd4',

  scrim: 'rgba(59, 42, 36, 0.42)',

  chart1: '#8a5613',
  chart2: '#3f6b8a',
  chart3: '#42663f',
  chart4: '#8f4f42',
  chart5: '#655a86',
})

export const palettes = { dark, light } as const

/** The rem values from globals.css, resolved at the 16px root. */
export const radii = Object.freeze({
  /** Cards, sheets, modals. */
  card: 12,
  /** Buttons, inputs, chips, tiles. */
  control: 8,
  /** Status pills. */
  pill: 4,
  full: 999,
})

export const space = Object.freeze({
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
})

/**
 * Minimum comfortable touch target.
 *
 * Android's guidance is 48dp. This app is used one-handed, outdoors, sometimes
 * with gloves, so nothing interactive goes below it — which is why the web's
 * 32px/40px control heights are not ported as-is.
 */
export const TOUCH_TARGET = 48
