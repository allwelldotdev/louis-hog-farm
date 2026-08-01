import type { TextStyle } from 'react-native'

/**
 * Typography — the dashboard's two voice classes, translated.
 *
 * `globals.css` carries the whole tone of voice in two component classes:
 *
 *   .figure  { font-variant-numeric: tabular-nums lining-nums;
 *              font-stretch: 112%; font-weight: 600; letter-spacing: -0.01em }
 *   .eyebrow { font-size: 0.6875rem; font-weight: 600;
 *              letter-spacing: 0.09em; text-transform: uppercase }
 *
 * Two React Native facts govern how they port.
 *
 * 1. **There is no `fontStretch`, and no way to drive a variable font's `wdth`
 *    axis.** The web loads Archivo with `axes: ['wdth']` and widens every live
 *    number to 112% so a KPI reads like a weighbridge display. Verified by
 *    unpacking `@expo-google-fonts/archivo@0.4.2`: it ships only normal-width
 *    static faces (100Thin..900Black plus italics), no Expanded instance.
 *
 *    So the width axis is dropped, and the size scale below is raised a step
 *    to compensate. Two alternatives were considered and rejected:
 *      - `transform: [{ scaleX: 1.12 }]` distorts stroke weight (semibold
 *        horizontally, semibold vertically is not the same face) and does not
 *        change laid-out width, so a scaled figure overruns its neighbour.
 *      - Hand-bundling an ArchivoExpanded face costs ~180 KB and a second
 *        family name threaded through every style, for one nuance at 5 inches.
 *
 * 2. **Android does not synthesise `fontWeight` against a custom
 *    `fontFamily`.** Ask for `Archivo_400Regular` at weight 600 and you get
 *    regular, silently — the classic "looked right on the simulator, shipped
 *    flat to the barn" bug. Weight is therefore selected by loading three
 *    discrete families and naming them. **Never write `fontWeight` in this
 *    app.** `FONTS` below is the complete set that gets loaded.
 */

export const FONT_REGULAR = 'Archivo_400Regular'
export const FONT_MEDIUM = 'Archivo_500Medium'
export const FONT_SEMIBOLD = 'Archivo_600SemiBold'

/**
 * Every number that can change on a refresh.
 *
 * `letterSpacing` in React Native is **px, not em**, so the web's `-0.01em`
 * has to be recomputed per size rather than set once.
 *
 * `fontVariant: ['tabular-nums']` is a nicety here, not load-bearing: Android
 * support varies by version, and the figures that would jitter sit in
 * fixed-width tiles, so a proportional-digit fallback cannot reflow anything.
 */
export function figure(size: number): TextStyle {
  return {
    fontFamily: FONT_SEMIBOLD,
    fontSize: size,
    letterSpacing: -0.01 * size,
    fontVariant: ['tabular-nums'],
  }
}

/** The ledger rule: a hairline label above a section, as on a tally sheet. */
export const eyebrow: TextStyle = {
  fontFamily: FONT_SEMIBOLD,
  fontSize: 11,
  letterSpacing: 0.09 * 11,
  textTransform: 'uppercase',
}

/**
 * The text scale.
 *
 * Sizes run above the dashboard's (its equivalents in brackets) because this
 * is read at arm's length, outdoors, often in sunlight — and because losing
 * the width axis costs some of the emphasis the web got for free. Body text
 * is 16, which is also the size below which Android offers to zoom the page.
 */
export const text = Object.freeze({
  /** Screen title. [text-xl/600] */
  h1: { fontFamily: FONT_SEMIBOLD, fontSize: 20, letterSpacing: -0.2 } as TextStyle,
  /** Card and section heading. [text-sm/500] */
  cardTitle: { fontFamily: FONT_MEDIUM, fontSize: 15 } as TextStyle,
  /** Default body. [text-sm] */
  body: { fontFamily: FONT_REGULAR, fontSize: 16 } as TextStyle,
  /** Emphasised body — list row primaries. */
  bodyMedium: { fontFamily: FONT_MEDIUM, fontSize: 16 } as TextStyle,
  /** Secondary line, hints, footnotes. [text-xs] */
  meta: { fontFamily: FONT_REGULAR, fontSize: 13 } as TextStyle,
  /** Button and chip labels. */
  label: { fontFamily: FONT_MEDIUM, fontSize: 15 } as TextStyle,
  /** Status pill. [11px] */
  pill: { fontFamily: FONT_MEDIUM, fontSize: 12 } as TextStyle,
})

/** Figure sizes, so call sites read as names rather than magic numbers. */
export const figureSize = Object.freeze({
  /** A KPI tile. */
  lg: 34,
  /** A card's headline number. */
  md: 22,
  /** Inline in a list row. */
  sm: 17,
})
