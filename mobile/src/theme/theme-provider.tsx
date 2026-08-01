import AsyncStorage from '@react-native-async-storage/async-storage'
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { Appearance } from 'react-native'

import {
  DEFAULT_THEME,
  THEME_STORAGE_KEY,
  readPreference,
  readSystemScheme,
  resolveTheme,
  writePreference,
  type ResolvedTheme,
  type ThemePreference,
} from './preference'
import { dark, light, type Palette } from './tokens'

/**
 * The theme store.
 *
 * The dashboard deliberately has no provider — its store is the `data-theme`
 * attribute, read through `useSyncExternalStore`, so the toggle keeps working
 * on the sign-in page which sits outside every provider. React Native has no
 * DOM attribute to hang that on, so here it genuinely is a context. The
 * contract it implements is identical; see `preference.ts`.
 *
 * Reading the stored preference is async, so `isReady` gates the first paint.
 * The root layout holds the splash screen up until fonts *and* theme have
 * resolved — one gate, no flash, the RN analogue of the web's inline
 * `THEME_SCRIPT` in <head>.
 */

type ThemeContextValue = {
  preference: ThemePreference
  resolved: ResolvedTheme
  colors: Palette
  setTheme: (preference: ThemePreference) => void
  isReady: boolean
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [preference, setPreference] = useState<ThemePreference>('system')
  const [systemScheme, setSystemScheme] = useState<ResolvedTheme | null>(
    () => readSystemScheme(Appearance.getColorScheme()),
  )
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    let cancelled = false
    AsyncStorage.getItem(THEME_STORAGE_KEY)
      .then((stored) => {
        if (!cancelled) setPreference(readPreference(stored))
      })
      // A theme that cannot be read is not worth failing to boot over: fall
      // through to `system`, which is the state the app already starts in.
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setIsReady(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Keeps `system` live while the app is open — the OS switching at sunset
  // should retint the app without a restart.
  useEffect(() => {
    const subscription = Appearance.addChangeListener(({ colorScheme }) => {
      setSystemScheme(readSystemScheme(colorScheme))
    })
    return () => subscription.remove()
  }, [])

  const setTheme = useCallback((next: ThemePreference) => {
    // Optimistic: the repaint should not wait on a disk write, and a failed
    // write costs the preference on next launch, not this one.
    setPreference(next)
    const value = writePreference(next)
    const write =
      value === null
        ? AsyncStorage.removeItem(THEME_STORAGE_KEY)
        : AsyncStorage.setItem(THEME_STORAGE_KEY, value)
    write.catch(() => {})
  }, [])

  const value = useMemo<ThemeContextValue>(() => {
    const resolved = resolveTheme(preference, systemScheme)
    return {
      preference,
      resolved,
      colors: resolved === 'light' ? light : dark,
      setTheme,
      isReady,
    }
  }, [preference, systemScheme, setTheme, isReady])

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeContextValue {
  const value = useContext(ThemeContext)
  if (!value) throw new Error('useTheme must be used inside ThemeProvider')
  return value
}

/** Shorthand for the common case — a component that only needs the palette. */
export function useColors(): Palette {
  return useTheme().colors
}

/**
 * The palette before the provider mounts.
 *
 * Only for the splash background and the pre-mount navigation container, where
 * there is no context yet and getting it wrong shows as a flash of the wrong
 * colour behind the first screen.
 */
export function initialColors(): Palette {
  return resolveTheme('system', readSystemScheme(Appearance.getColorScheme())) === 'light'
    ? light
    : dark
}

export { DEFAULT_THEME }
