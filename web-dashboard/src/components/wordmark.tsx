import { cn } from '@/lib/utils'

/** The ochre rule under the name is the same 2px mark the sidebar uses for the
 *  active page — one motif, doing the same job in both places. */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex flex-col gap-1.5', className)}>
      <span className="text-base font-semibold tracking-tight text-ink">Bright Acres</span>
      <span className="h-0.5 w-8 bg-ochre" aria-hidden />
    </span>
  )
}
