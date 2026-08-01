'use client'

import { Toaster as Sonner } from 'sonner'

import { useTheme } from '@/lib/theme/use-theme'

/**
 * The app's single toast surface, themed off the design tokens.
 *
 * Sonner ships its own stylesheet, so the class overrides carry Tailwind's
 * trailing `!` to win the cascade. `richColors` is deliberately off: it would
 * introduce a second green and a second red alongside `--color-gain` and
 * `--color-alert`.
 */
export function Toaster() {
  // The *resolved* theme, not `'system'`: Sonner's own system handling reads
  // `prefers-color-scheme`, which would disagree with a manual override.
  const { resolvedTheme } = useTheme()

  return (
    <Sonner
      theme={resolvedTheme}
      position="bottom-right"
      toastOptions={{
        classNames: {
          toast: 'bg-surface! border-rule! text-ink! rounded-card! shadow-panel! font-sans!',
          title: 'text-ink! text-sm! font-medium!',
          description: 'text-muted! text-sm!',
          actionButton: 'bg-ochre! text-on-accent!',
          cancelButton: 'bg-raised! text-muted!',
          error: 'text-alert!',
          success: 'text-gain!',
        },
      }}
    />
  )
}
