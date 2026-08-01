'use client'

import { useSyncExternalStore } from 'react'

import {
  type ResolvedTheme,
  type ThemePreference,
  readPreference,
  readResolved,
  setPreference,
  subscribe,
} from '@/lib/theme/theme'

/**
 * `useSyncExternalStore` rather than state-in-an-effect: its server snapshot is
 * used for the hydration render as well as SSR, so the two agree by
 * construction and React re-renders with the client value immediately after —
 * the same reason `ClientOnly` uses it, and the same lint rule
 * (`react-hooks/set-state-in-effect`) that rules the alternative out here.
 *
 * The server snapshots are the pre-JS defaults, not a guess at the user's
 * preference: only the toggle's icon depends on them, and the colours were
 * already correct before React booted.
 */
export function useTheme(): {
  preference: ThemePreference
  resolvedTheme: ResolvedTheme
  setTheme: (preference: ThemePreference) => void
} {
  const preference = useSyncExternalStore<ThemePreference>(
    subscribe,
    readPreference,
    () => 'system',
  )
  const resolvedTheme = useSyncExternalStore<ResolvedTheme>(subscribe, readResolved, () => 'dark')

  return { preference, resolvedTheme, setTheme: setPreference }
}
