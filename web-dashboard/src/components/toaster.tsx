'use client'

import { Toaster as Sonner } from 'sonner'

/**
 * The app's single toast surface, themed off the design tokens.
 *
 * Sonner ships its own stylesheet, so the class overrides carry Tailwind's
 * trailing `!` to win the cascade. `richColors` is deliberately off: it would
 * introduce a second green and a second red alongside `--color-gain` and
 * `--color-alert`.
 */
export function Toaster() {
  return (
    <Sonner
      theme="dark"
      position="bottom-right"
      toastOptions={{
        classNames: {
          toast:
            'bg-surface! border-rule! text-ink! rounded-card! shadow-lg! shadow-black/40! font-sans!',
          title: 'text-ink! text-sm! font-medium!',
          description: 'text-muted! text-sm!',
          actionButton: 'bg-ochre! text-ground!',
          cancelButton: 'bg-raised! text-muted!',
          error: 'text-alert!',
          success: 'text-gain!',
        },
      }}
    />
  )
}
