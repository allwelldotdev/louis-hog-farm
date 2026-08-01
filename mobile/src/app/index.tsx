import { Redirect } from 'expo-router'
import { View } from 'react-native'

import { useAuth } from '@/components/auth-provider'
import { useColors } from '@/theme/theme-provider'

/**
 * The boot route: a refresh token on the device sends you to the app, its
 * absence to sign-in.
 *
 * Renders a bare coloured view rather than a spinner while `status` settles —
 * reading SecureStore takes a frame or two, and a spinner that flashes for
 * 30ms reads as a stutter rather than as progress.
 */
export default function Boot() {
  const { status } = useAuth()
  const colors = useColors()

  if (status === 'loading') return <View style={{ flex: 1, backgroundColor: colors.ground }} />
  return <Redirect href={status === 'signed-in' ? '/today' : '/sign-in'} />
}
