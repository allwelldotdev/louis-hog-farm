import {
  Archivo_400Regular,
  Archivo_500Medium,
  Archivo_600SemiBold,
  useFonts,
} from '@expo-google-fonts/archivo'
import { Stack } from 'expo-router'
import * as SplashScreen from 'expo-splash-screen'
import { StatusBar } from 'expo-status-bar'
import { useEffect } from 'react'
import { SafeAreaProvider } from 'react-native-safe-area-context'

import { ThemeProvider, useTheme } from '@/theme/theme-provider'

// Held until fonts *and* the stored theme have resolved. One gate rather than
// two means no flash of the wrong palette and no text reflow when Archivo
// swaps in — the RN analogue of the dashboard's inline <head> theme script.
SplashScreen.preventAutoHideAsync().catch(() => {})

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AppShell />
      </ThemeProvider>
    </SafeAreaProvider>
  )
}

function AppShell() {
  const { colors, resolved, isReady: themeReady } = useTheme()

  // Exactly the three weights the type scale names. Android will not
  // synthesise a weight against a custom family, so each one has to be a real
  // face — see src/theme/type.ts.
  const [fontsReady, fontError] = useFonts({
    Archivo_400Regular,
    Archivo_500Medium,
    Archivo_600SemiBold,
  })

  // A font that fails to load is not worth a blank screen: RN falls back to
  // the system face and the app is still entirely usable.
  const ready = themeReady && (fontsReady || fontError !== null)

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
