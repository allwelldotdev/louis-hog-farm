/**
 * The weight sparkline's geometry.
 *
 * Pure and node-testable: no React, no `react-native-svg`. The component is a
 * thin wrapper that turns `d` into a `<Path>`.
 *
 * Every failure mode in here is a division by zero, and each one produces a
 * *plausible-looking wrong chart* rather than a crash — which is exactly the
 * kind of bug nobody reports. Hence the tests.
 */

export type SparklinePoint = { date: string; weight_kg: number }

export type Sparkline = {
  /** An SVG path, or `''` when there is only one point to draw. */
  d: string
  /** The last point, for the end dot. */
  last: { x: number; y: number }
  min: number
  max: number
  first: number
  latest: number
  count: number
}

/** Round to one decimal so the path string does not carry float noise. */
function round(value: number): number {
  return Math.round(value * 10) / 10
}

export function buildSparkline(
  points: SparklinePoint[],
  width: number,
  height: number,
  padding = 4,
): Sparkline | null {
  // Nothing recorded: the caller shows "never been weighed" rather than an
  // empty box, which would look like a loading state that never resolves.
  if (points.length === 0) return null

  const weights = points.map((point) => point.weight_kg)
  const min = Math.min(...weights)
  const max = Math.max(...weights)

  const top = padding
  const bottom = height - padding
  const span = max - min

  /**
   * A flat series — every weigh-in identical, which happens with one point and
   * with a stalled animal — would divide by zero. Pinning to the vertical
   * centre draws the true shape: a straight line, sitting mid-band.
   */
  const y = (weight: number) =>
    span === 0
      ? round((top + bottom) / 2)
      : round(bottom - ((weight - min) / span) * (bottom - top))

  /**
   * x is spaced by **index, not by date**.
   *
   * Real weigh-ins cluster: three in a week, then nothing for two months. Laid
   * out by date that becomes a spike crushed against the left edge and a long
   * flat run, which reads as "this animal stopped growing" when it means "no
   * one weighed it". Even spacing is what a sparkline is understood to mean.
   */
  const left = padding
  const right = width - padding
  const step = points.length > 1 ? (right - left) / (points.length - 1) : 0
  const x = (index: number) => round(points.length > 1 ? left + index * step : (left + right) / 2)

  const coords = points.map((point, index) => ({ x: x(index), y: y(point.weight_kg) }))

  return {
    // One point has no line to draw — only the dot the component renders from
    // `last`. An 'M' with no 'L' would be an invisible path on some renderers
    // and a dot on others.
    d:
      coords.length > 1
        ? coords.map((c, i) => `${i === 0 ? 'M' : 'L'}${c.x} ${c.y}`).join(' ')
        : '',
    last: coords[coords.length - 1],
    min,
    max,
    first: weights[0],
    latest: weights[weights.length - 1],
    count: points.length,
  }
}
