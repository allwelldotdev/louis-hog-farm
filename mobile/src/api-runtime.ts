import AsyncStorage from '@react-native-async-storage/async-storage'
import Constants from 'expo-constants'
import * as SecureStore from 'expo-secure-store'

import { createApiClient, type TokenStorage } from '@/lib/api/client'
import { API_URL_STORAGE_KEY, resolveBaseUrl } from '@/lib/api/base-url'

/**
 * Where the platform meets the pure code.
 *
 * This file lives outside `src/lib/` on purpose: it is the one module that
 * imports `expo-*` and `@react-native-async-storage`, so everything in
 * `src/lib/` stays loadable in plain node and therefore testable without a
 * renderer. Nothing here has logic worth testing — it is wiring.
 *
 * **Storage split.** Tokens go in SecureStore, which on Android is backed by
 * the Keystore. Everything else — theme, server override, recent hogs, the
 * query cache — goes in AsyncStorage, which is plain files. SecureStore values
 * are also size-capped, which is why the two tokens are separate keys rather
 * than one JSON blob.
 */

const secureStorage: TokenStorage = {
  get: (key) => SecureStore.getItemAsync(key),
  set: (key, value) => SecureStore.setItemAsync(key, value),
  remove: (key) => SecureStore.deleteItemAsync(key),
}

/**
 * The resolved base URL, cached in memory.
 *
 * Read synchronously by every request, so it cannot be an await. `loadBaseUrl`
 * populates it at boot and `setBaseUrlOverride` updates it when Settings
 * changes the server.
 */
let baseUrl: string | null = null

function envBaseUrl(): string | null {
  return process.env.EXPO_PUBLIC_API_URL ?? null
}

function metroHostUri(): string | null {
  // Present in Expo Go and in a dev build; absent in a standalone build, which
  // is why it is only the last fallback.
  return Constants.expoConfig?.hostUri ?? null
}

export async function loadBaseUrl(): Promise<string | null> {
  const override = await AsyncStorage.getItem(API_URL_STORAGE_KEY).catch(() => null)
  baseUrl = resolveBaseUrl({ override, env: envBaseUrl(), hostUri: metroHostUri() })
  return baseUrl
}

export function getBaseUrl(): string | null {
  return baseUrl
}

/** What the resolver *would* pick with no override — shown in Settings. */
export function defaultBaseUrl(): string | null {
  return resolveBaseUrl({ env: envBaseUrl(), hostUri: metroHostUri() })
}

/**
 * Point the app at a different server.
 *
 * The caller is responsible for clearing the query cache and signing out:
 * every cached figure was true of the old server and is a lie about the new
 * one.
 */
export async function setBaseUrlOverride(value: string | null): Promise<string | null> {
  if (value === null) await AsyncStorage.removeItem(API_URL_STORAGE_KEY)
  else await AsyncStorage.setItem(API_URL_STORAGE_KEY, value)
  return loadBaseUrl()
}

/**
 * Set by the auth provider once it can navigate. Kept as a mutable hook rather
 * than a constructor argument because the client is created at module load,
 * before any router exists.
 */
let authExpiredHandler: (() => void) | null = null

export function onAuthExpired(handler: (() => void) | null): void {
  authExpiredHandler = handler
}

export const api = createApiClient({
  storage: secureStorage,
  getBase: getBaseUrl,
  onAuthExpired: () => authExpiredHandler?.(),
})
