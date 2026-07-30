import { NO_VALUE } from '@/lib/format'
import { cn } from '@/lib/utils'

/**
 * One headline figure.
 *
 * The value carries `.figure` and the unit does not: tabular numerals and the
 * widened width axis make digits read as an instrument and hold their position
 * when a poll lands mid-glance, but applying the same treatment to "kg/day"
 * just stretches a word.
 *
 * Tone is reserved for figures that carry a judgement — a mortality rate, an
 * open alert count. Colouring every tile would make none of them mean anything.
 */

const TONE = {
  default: 'text-ink',
  gain: 'text-gain',
  alert: 'text-alert',
} as const

export type MetricTone = keyof typeof TONE

export function MetricCard({
  label,
  value,
  unit,
  detail,
  tone = 'default',
}: {
  label: string
  value: string
  unit?: string
  detail?: string
  tone?: MetricTone
}) {
  return (
    <div className="border-t border-rule pt-3">
      <p className="eyebrow">{label}</p>
      <p className="mt-1.5 flex items-baseline gap-1.5">
        <span className={cn('figure text-2xl', TONE[tone])}>{value}</span>
        {/* A unit beside "—" would claim the measurement exists in kilograms
            when what is being reported is that it does not exist. */}
        {unit && value !== NO_VALUE ? <span className="text-xs text-muted">{unit}</span> : null}
      </p>
      {detail ? <p className="mt-1 text-xs text-muted">{detail}</p> : null}
    </div>
  )
}
