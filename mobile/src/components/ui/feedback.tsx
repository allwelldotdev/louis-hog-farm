import type { ReactNode } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native'

import { useColors } from '@/theme/theme-provider'
import { radii, space } from '@/theme/tokens'
import { text } from '@/theme/type'

/**
 * The small states every screen needs: banner, skeleton, empty, error.
 *
 * Grouped in one file because each is a handful of lines and they are almost
 * always reached for together.
 */

export type BannerTone = 'alert' | 'ochre' | 'gain'

/** A submit failure, a locked notice, a success confirmation. */
export function Banner({
  tone,
  message,
  action,
}: {
  tone: BannerTone
  message: string
  action?: ReactNode
}) {
  const colors = useColors()
  const palette = {
    alert: { backgroundColor: colors.alertWash, color: colors.alert },
    ochre: { backgroundColor: colors.ochreWash, color: colors.ochre },
    gain: { backgroundColor: colors.gainWash, color: colors.gain },
  }[tone]

  return (
    <View
      accessibilityRole="alert"
      style={[styles.banner, { backgroundColor: palette.backgroundColor }]}
    >
      <Text style={[text.meta, styles.flex, { color: palette.color }]}>{message}</Text>
      {action}
    </View>
  )
}

/**
 * A placeholder block. **No shimmer.**
 *
 * The brief asks for fewer animations and more speed. A pulsing placeholder
 * runs an animation driver for the entire time a request is in flight, on
 * exactly the mid-range hardware least able to spare it, and communicates
 * nothing a static block does not.
 */
export function Skeleton({
  height = 64,
  radius = radii.control,
}: {
  height?: number
  radius?: number
}) {
  const colors = useColors()
  return <View style={{ height, borderRadius: radius, backgroundColor: colors.raised }} />
}

export function LoadingBlock({ label = 'Loading…' }: { label?: string }) {
  const colors = useColors()
  return (
    <View style={styles.centred}>
      <ActivityIndicator color={colors.ochre} />
      <Text style={[text.meta, { color: colors.muted }]}>{label}</Text>
    </View>
  )
}

export function EmptyState({ message }: { message: string }) {
  const colors = useColors()
  return (
    <View style={styles.centred}>
      <Text style={[text.body, styles.centredText, { color: colors.muted }]}>{message}</Text>
    </View>
  )
}

/**
 * A failed read. Always offers a retry — a dead end with no way forward is the
 * worst thing to hand someone standing in a barn.
 */
export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const colors = useColors()
  return (
    <View style={styles.centred}>
      <Text style={[text.body, styles.centredText, { color: colors.alert }]}>{message}</Text>
      {onRetry ? (
        <Pressable
          accessibilityRole="button"
          onPress={onRetry}
          style={[styles.retry, { borderColor: colors.rule }]}
        >
          <Text style={[text.label, { color: colors.ink }]}>Try again</Text>
        </Pressable>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    borderRadius: radii.control,
    paddingHorizontal: space.md,
    paddingVertical: space.md,
  },
  centred: { alignItems: 'center', gap: space.md, paddingVertical: space.xxl },
  centredText: { textAlign: 'center' },
  retry: {
    minHeight: 44,
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: radii.control,
    paddingHorizontal: space.lg,
  },
})
