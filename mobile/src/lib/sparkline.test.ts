import { describe, expect, it } from 'vitest'

import { buildSparkline, type SparklinePoint } from './sparkline'

const W = 100
const H = 40
const PAD = 4

function series(...weights: number[]): SparklinePoint[] {
  return weights.map((weight_kg, index) => ({
    date: `2026-07-${String(index + 1).padStart(2, '0')}`,
    weight_kg,
  }))
}

describe('buildSparkline', () => {
  it('returns null for an animal that has never been weighed', () => {
    // The caller shows a message; an empty box reads as a stuck loading state.
    expect(buildSparkline([], W, H)).toBeNull()
  })

  it('draws no line for a single point, only a dot', () => {
    const result = buildSparkline(series(42), W, H, PAD)!
    expect(result.d).toBe('')
    expect(result.count).toBe(1)
    // Centred both ways: there is no range to span in either axis.
    expect(result.last).toEqual({ x: (PAD + (W - PAD)) / 2, y: (PAD + (H - PAD)) / 2 })
  })

  it('pins a flat series to the vertical centre instead of dividing by zero', () => {
    const result = buildSparkline(series(50, 50, 50), W, H, PAD)!
    const ys = result.d.match(/[ML][\d.]+ ([\d.]+)/g)!.map((m) => Number(m.split(' ')[1]))
    expect(new Set(ys).size).toBe(1)
    expect(ys[0]).toBe((PAD + (H - PAD)) / 2)
    expect(result.min).toBe(50)
    expect(result.max).toBe(50)
  })

  it('puts the lowest weight at the bottom and the highest at the top', () => {
    // SVG y grows downward, so the maximum must have the *smallest* y.
    const result = buildSparkline(series(10, 30, 20), W, H, PAD)!
    const ys = result.d.match(/[ML][\d.]+ ([\d.]+)/g)!.map((m) => Number(m.split(' ')[1]))
    expect(ys[0]).toBe(H - PAD)
    expect(ys[1]).toBe(PAD)
    expect(ys[2]).toBeGreaterThan(PAD)
    expect(ys[2]).toBeLessThan(H - PAD)
  })

  it('spaces points evenly by index, ignoring the gaps between dates', () => {
    // Three weigh-ins in a week then one two months later must not crush the
    // first three into the left edge — that reads as a stalled animal when it
    // means nobody weighed it.
    const clustered: SparklinePoint[] = [
      { date: '2026-05-01', weight_kg: 10 },
      { date: '2026-05-02', weight_kg: 20 },
      { date: '2026-05-03', weight_kg: 30 },
      { date: '2026-07-30', weight_kg: 40 },
    ]
    const result = buildSparkline(clustered, W, H, PAD)!
    const xs = result.d.match(/[ML]([\d.]+) /g)!.map((m) => Number(m.slice(1)))
    const gaps = xs.slice(1).map((x, i) => x - xs[i])
    // Equal to within the 0.1 the coordinates are deliberately rounded to —
    // the point is that the two-month gap buys no extra width. Laid out by
    // date, the last gap would be about sixty times the others.
    expect(Math.max(...gaps) - Math.min(...gaps)).toBeLessThanOrEqual(0.1 + 1e-9)
  })

  it('starts at the left padding and ends at the right', () => {
    const result = buildSparkline(series(1, 2, 3), W, H, PAD)!
    const xs = result.d.match(/[ML]([\d.]+) /g)!.map((m) => Number(m.slice(1)))
    expect(xs[0]).toBe(PAD)
    expect(xs[xs.length - 1]).toBe(W - PAD)
    expect(result.last.x).toBe(W - PAD)
  })

  it('reports the figures shown beneath the chart', () => {
    const result = buildSparkline(series(30, 45, 60.5), W, H, PAD)!
    expect(result.first).toBe(30)
    expect(result.latest).toBe(60.5)
    expect(result.min).toBe(30)
    expect(result.max).toBe(60.5)
    expect(result.count).toBe(3)
  })

  it('handles a declining series without inverting', () => {
    const result = buildSparkline(series(60, 40), W, H, PAD)!
    const ys = result.d.match(/[ML][\d.]+ ([\d.]+)/g)!.map((m) => Number(m.split(' ')[1]))
    expect(ys[0]).toBeLessThan(ys[1])
    expect(result.latest - result.first).toBe(-20)
  })
})
