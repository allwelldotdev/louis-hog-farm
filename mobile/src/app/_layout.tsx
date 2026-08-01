import { Stack } from 'expo-router'

// Placeholder root layout. P1 wraps this in the theme provider and the splash
// gate; P2 adds the query client; P3 adds auth and the data-version poller.
export default function RootLayout() {
  return <Stack screenOptions={{ headerShown: false }} />
}
