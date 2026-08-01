'use client'

import { Monitor, Moon, Sun } from 'lucide-react'

import { Button } from '@/components/ui/button'
import type { ThemePreference } from '@/lib/theme/theme'
import { useTheme } from '@/lib/theme/use-theme'

/**
 * Three states, not two.
 *
 * A two-way switch has to write an explicit choice on the first click, which
 * permanently opts the user out of their OS preference with no way back — and
 * this is a dashboard left open across a sunset.
 */
const CYCLE: Record<ThemePreference, ThemePreference> = {
  system: 'light',
  light: 'dark',
  dark: 'system',
}

const ICON = { system: Monitor, light: Sun, dark: Moon }

const LABEL: Record<ThemePreference, string> = {
  system: 'follow system',
  light: 'light',
  dark: 'dark',
}

export function ThemeToggle() {
  const { preference, setTheme } = useTheme()
  const Icon = ICON[preference]
  const next = CYCLE[preference]

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(next)}
      aria-label={`Theme: ${LABEL[preference]}. Switch to ${LABEL[next]}.`}
      title={`Theme: ${LABEL[preference]} — switch to ${LABEL[next]}`}
    >
      <Icon aria-hidden />
    </Button>
  )
}
