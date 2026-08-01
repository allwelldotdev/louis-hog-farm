/**
 * The theme store is the `data-theme` attribute on `<html>`.
 *
 * No provider and no context: the attribute is already global, already set
 * before React exists (see `THEME_SCRIPT`), and already the thing the CSS
 * reads. Wrapping it in a context would add a second copy of the same state and
 * a client boundary in the root layout — and the sign-in page, which lives
 * outside `(app)`'s providers, would then need its own.
 */

export const THEME_STORAGE_KEY = 'bright-acres:theme'

/** What the user asked for. `system` is the default and is not persisted. */
export type ThemePreference = 'system' | 'light' | 'dark'
/** What is actually painted. */
export type ResolvedTheme = 'light' | 'dark'

const LIGHT_QUERY = '(prefers-color-scheme: light)'

/**
 * Runs synchronously in `<head>`, before first paint, so the correct theme is on
 * `<html>` by the time the first pixel lands. Anything asynchronous here — a
 * module import, a `next/script` strategy, a `useEffect` — paints dark first and
 * corrects afterwards, which is the flash this exists to prevent.
 *
 * The media query asks for `light`, not `dark`, because dark is the default:
 * `no-preference` matches neither, and falling through to dark is what the app
 * shipped with.
 */
export const THEME_SCRIPT = `(function(){try{
var k=${JSON.stringify(THEME_STORAGE_KEY)},s=localStorage.getItem(k);
var t=(s==="light"||s==="dark")?s:(matchMedia(${JSON.stringify(LIGHT_QUERY)}).matches?"light":"dark");
document.documentElement.setAttribute("data-theme",t);
}catch(e){document.documentElement.setAttribute("data-theme","dark")}})()`

const listeners = new Set<() => void>()

function notify(): void {
  for (const listener of listeners) listener()
}

function systemTheme(): ResolvedTheme {
  return window.matchMedia(LIGHT_QUERY).matches ? 'light' : 'dark'
}

export function readPreference(): ThemePreference {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY)
    return stored === 'light' || stored === 'dark' ? stored : 'system'
  } catch {
    return 'system'
  }
}

/** Read straight off the attribute the script wrote — one source of truth. */
export function readResolved(): ResolvedTheme {
  return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark'
}

function apply(preference: ThemePreference): void {
  const resolved = preference === 'system' ? systemTheme() : preference
  document.documentElement.setAttribute('data-theme', resolved)
}

export function setPreference(preference: ThemePreference): void {
  try {
    if (preference === 'system') localStorage.removeItem(THEME_STORAGE_KEY)
    else localStorage.setItem(THEME_STORAGE_KEY, preference)
  } catch {
    // Storage denied still leaves the theme applied for this tab.
  }
  apply(preference)
  notify()
}

/**
 * `storage` fires only in *other* tabs, which is exactly what cross-tab sync
 * needs; the media listener keeps `system` honest when the OS flips at sunset.
 */
export function subscribe(listener: () => void): () => void {
  listeners.add(listener)

  const media = window.matchMedia(LIGHT_QUERY)
  const onMedia = () => {
    if (readPreference() === 'system') apply('system')
    notify()
  }
  const onStorage = (event: StorageEvent) => {
    if (event.key !== THEME_STORAGE_KEY) return
    apply(readPreference())
    notify()
  }

  media.addEventListener('change', onMedia)
  window.addEventListener('storage', onStorage)

  return () => {
    listeners.delete(listener)
    media.removeEventListener('change', onMedia)
    window.removeEventListener('storage', onStorage)
  }
}
