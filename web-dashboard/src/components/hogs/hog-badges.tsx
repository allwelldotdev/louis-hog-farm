import type { HogStatus } from '@/lib/api/types'
import { humanize } from '@/lib/format'
import { cn } from '@/lib/utils'

/**
 * Status carries a colour because it is the one hog field that changes what the
 * row means: an archived animal is out of the herd and a deceased one is a
 * mortality event. Every other field is just text and is left as text.
 */
const STATUS_TONE: Record<HogStatus, string> = {
  active: 'bg-gain-wash text-gain',
  archived: 'bg-raised text-muted',
  deceased: 'bg-alert-wash text-alert',
}

export function StatusBadge({ status }: { status: HogStatus }) {
  return (
    <span
      className={cn(
        'inline-block rounded-sm px-1.5 py-0.5 text-[0.6875rem] font-medium',
        STATUS_TONE[status],
      )}
    >
      {humanize(status)}
    </span>
  )
}
