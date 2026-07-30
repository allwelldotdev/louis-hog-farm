/**
 * The sign-in page's hero: a herd growth band.
 *
 * Not decoration. This is the exact shape `/dashboard/herd-growth` draws with
 * real data — median weight with the tenth and ninetieth percentile either
 * side — so the first thing a visitor sees is the thing the product is for.
 * The band widening as it climbs is the whole argument for the percentile
 * band over a plain average: a herd whose mean rises while its bottom decile
 * flattens has animals falling behind, and an average alone hides that.
 *
 * The curve is generated, not sampled from the database. It is illustrative and
 * says so — no farm's figures appear on a page anyone can reach.
 */

const WEEKS = 26
const WIDTH = 600
const HEIGHT = 320
const TOP = 24
const BOTTOM = 288
const MAX_KG = 165

function y(kg: number): number {
  return BOTTOM - (kg / MAX_KG) * (BOTTOM - TOP)
}

function x(week: number): number {
  return (week / WEEKS) * WIDTH
}

type Point = { week: number; median: number; p10: number; p90: number }

const points: Point[] = Array.from({ length: WEEKS + 1 }, (_, week) => {
  const t = week / WEEKS
  // Growth decelerates as animals approach finishing weight; the spread widens
  // because individual variation compounds over a production cycle.
  const median = 16 + 104 * Math.pow(t, 0.86)
  const spread = 5 + 38 * t
  return { week, median, p10: median - spread * 0.85, p90: median + spread }
})

function line(select: (point: Point) => number): string {
  return points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(p.week)} ${y(select(p))}`).join(' ')
}

const bandPath = `${line((p) => p.p90)} ${points
  .slice()
  .reverse()
  .map((p) => `L${x(p.week)} ${y(p.p10)}`)
  .join(' ')} Z`

const medianPath = line((p) => p.median)

const gridlines = [40, 80, 120, 160]

export function GrowthBand({ className }: { className?: string }) {
  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      className={className}
      role="img"
      aria-label="Illustration of herd weight rising over twenty-six weeks, with a widening band between the tenth and ninetieth percentile."
    >
      {gridlines.map((kg) => (
        <line
          key={kg}
          x1="0"
          x2={WIDTH}
          y1={y(kg)}
          y2={y(kg)}
          stroke="var(--color-rule)"
          strokeWidth="1"
        />
      ))}

      <path d={bandPath} fill="var(--color-ochre)" fillOpacity="0.18" className="animate-rise" />

      {/* The band's own edges, drawn faintly. Without them the fill dissolves
          into the background at the narrow end and the percentile idea is lost
          exactly where it matters — early, when the herd is still uniform. */}
      {(['p10', 'p90'] as const).map((edge) => (
        <path
          key={edge}
          d={line((p) => p[edge])}
          fill="none"
          stroke="var(--color-ochre)"
          strokeOpacity="0.45"
          strokeWidth="1"
        />
      ))}

      <path
        d={medianPath}
        fill="none"
        stroke="var(--color-ochre)"
        strokeWidth="2"
        strokeLinecap="round"
        pathLength={1}
        className="animate-draw [stroke-dasharray:1]"
      />

      {/* Where the herd is now. An instrument shows its current reading; a line
          that simply stops at the edge of the frame does not. */}
      <circle
        cx={x(WEEKS)}
        cy={y(points[WEEKS].median)}
        r="4"
        fill="var(--color-ochre)"
        className="animate-rise"
      />
    </svg>
  )
}
