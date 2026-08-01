import {
  Archivo_400Regular,
  Archivo_500Medium,
  Archivo_600SemiBold,
  useFonts,
} from '@expo-google-fonts/archivo'
import { Stack } from 'expo-router'
import * as SplashScreen from 'expo-splash-screen'
import { StatusBar } from 'expo-status-bar'
import { useEffect, useState } from 'react'
import { SafeAreaProvider } from 'react-native-safe-area-context'

import { loadBaseUrl } from '@/api-runtime'
import { AuthProvider } from '@/components/auth-provider'
import { QueryProvider } from '@/components/providers'
import { ThemeProvider, useTheme } from '@/theme/theme-provider'

// Held until fonts, the stored theme *and* the server address have resolved.
// One gate rather than three means no flash of the wrong palette, no text
// reflow when Archivo swaps in, and no request firing before it knows where to
// go — the RN analogue of the dashboard's inline <head> theme script.
SplashScreen.preventAutoHideAsync().catch(() => {})

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        {/* Auth sits inside Query: signing out clears the cache, and the
            expiry handler needs a client to clear. */}
        <QueryProvider>
          <AuthProvider>
            <AppShell />
          </AuthProvider>
        </QueryProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  )
}

function AppShell() {
  const { colors, resolved, isReady: themeReady } = useTheme()
  const [baseReady, setBaseReady] = useState(false)

  // Exactly the three weights the type scale names. Android will not
  // synthesise a weight against a custom family, so each has to be a real face
  // — see src/theme/type.ts.
  const [fontsReady, fontError] = useFonts({
    Archivo_400Regular,
    Archivo_500Medium,
    Archivo_600SemiBold,
  })

  useEffect(() => {
    loadBaseUrl()
      // A missing address is a state the sign-in screen explains and offers to
      // fix, not a reason to fail to boot.
      .catch(() => {})
      .finally(() => setBaseReady(true))
  }, [])

  // A font that fails to load is not worth a blank screen: RN falls back to
  // the system face and the app stays entirely usable.
  const ready = themeReady && baseReady && (fontsReady || fontError !== null)

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {})
  }, [ready])

  if (!ready) return null

  return (
    <>
      {/* The OS chrome has to follow the palette, or it fights it. */}
      <StatusBar style={resolved === 'light' ? 'dark' : 'light'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.ground },
          animation: 'fade',
        }}
      />
    </>
  )
}
