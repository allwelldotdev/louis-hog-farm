'use client'

import { X } from 'lucide-react'
import { useEffect, useRef } from 'react'

import { Button } from '@/components/ui/button'

/**
 * A modal on the native `<dialog>` element.
 *
 * `showModal()` already provides the focus trap, the inert background, Escape
 * to dismiss and the top-layer stacking that a hand-rolled overlay spends
 * several hundred lines and a focus-management library getting wrong. The only
 * thing wired up here is React's `open` prop driving the imperative methods,
 * plus `onCancel` so Escape reports back through the same handler as the close
 * button rather than desynchronising the caller's state.
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
}: {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  children: React.ReactNode
}) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
      className="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-card border border-rule bg-surface p-0 text-ink backdrop:bg-scrim"
    >
      <div className="flex items-start justify-between gap-4 border-b border-rule px-5 py-3.5">
        <div className="min-w-0">
          <h2 className="text-sm font-medium text-ink">{title}</h2>
          {description ? <p className="mt-0.5 text-xs text-muted">{description}</p> : null}
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close">
          <X aria-hidden />
        </Button>
      </div>

      <div className="px-5 py-4">{children}</div>
    </dialog>
  )
}
