/**
 * Theme preference resolution.
 *
 * Pure by design — no AsyncStorage, no `Appearance`, no React — so the whole
 * contract is testable in plain node. The RN shell lives in
 * `theme-provider.tsx`.
 *
 * The storage contract is copied exactly from the dashboard
 * (`web-dashboard/src/lib/theme/theme.ts`):
 *
 *   - same key, `bright-acres:theme`
 *   - only `'light'` and `'dark'` are ever written
 *   - **`'system'` is represented by the ABSENCE of the key**, not by the
 *     string `'system'`
 *
 * That last point is the one worth stating twice. Writing `'system'` would
 * work, and would also mean a device that had once been set to system could
 * never be told apart from one that had never been touched. Absence is what
 * the web does, and keeping the two clients on one contract means a reader can
 * reason about either from the other.
 */

export type ThemePreference = 'system' | 'light' | 'dark'
export type ResolvedTheme = 'light' | 'dark'

export const THEME_STORAGE_KEY = 'bright-acres:theme'

/**
 * Dark is the default, as on the web, and is what a device reports when its
 * colour scheme is unavailable (`Appearance.getColorScheme()` returns `null`
 * on Android when `userInterfaceStyle` is not `automatic` — which is why
 * app.json sets it).
 */
export const DEFAULT_THEME: ResolvedTheme = 'dark'

/** What came out of storage -> a preference. Anything unexpected is `system`. */
export function readPreference(stored: string | null | undefined): ThemePreference {
  return stored === 'light' || stored === 'dark' ? stored : 'system'
}

/**
 * What to persist for a preference: `null` means "delete the key".
 *
 * Returning `null` rather than throwing keeps the caller a one-liner —
 * `value === null ? removeItem(key) : setItem(key, value)`.
 */
export function writePreference(preference: ThemePreference): ResolvedTheme | null {
  return preference === 'system' ? null : preference
}

/**
 * Narrow whatever `Appearance.getColorScheme()` returned to a theme.
 *
 * React Native types that as `ColorSchemeName`, which is
 * `'light' | 'dark' | 'unspecified' | null | undefined` — the `'unspecified'`
 * arm being the case nobody remembers, and the one an Android device reports
 * when it has no system-wide setting. Treating it as `null` sends it through
 * the same default as an absent value.
 */
export function readSystemScheme(scheme: string | null | undefined): ResolvedTheme | null {
  return scheme === 'light' || scheme === 'dark' ? scheme : null
}

/** Preference + what the OS currently reports -> the theme actually rendered. */
export function resolveTheme(
  preference: ThemePreference,
  systemScheme: ResolvedTheme | null | undefined,
): ResolvedTheme {
  if (preference !== 'system') return preference
  return systemScheme ?? DEFAULT_THEME
}

/**
 * The three-state cycle, matching the dashboard's topbar toggle.
 *
 * Settings renders this as three chips rather than a cycling icon button: a
 * phone has no hover title, so a lone icon is a guess about what happens next.
 * The order is still worth pinning here — it is the same mental model, and the
 * chips are laid out in it.
 */
export const THEME_CYCLE: Record<ThemePreference, ThemePreference> = {
  system: 'light',
  light: 'dark',
  dark: 'system',
}

export const THEME_LABELS: Record<ThemePreference, string> = {
  system: 'System',
  light: 'Light',
  dark: 'Dark',
}
