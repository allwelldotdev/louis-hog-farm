import type { ReactNode } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native'

import { useColors } from '@/theme/theme-provider'
import { radii, space } from '@/theme/tokens'
import { text } from '@/theme/type'

/**
 * The dashboard's four button variants, sized for a barn.
 *
 * The web's heights are h-8 (32) / h-10 (40). Both are below Android's 48dp
 * minimum touch target and unusable with gloves, so the scale here starts at
 * 44 and the primary action on a capture form is 56.
 *
 * No press animation — `android_ripple` only. The brief asks for fewer
 * animations and more speed, and a scale transform on press is a frame cost
 * that communicates nothing the ripple has not already communicated.
 */

export type ButtonVariant = 'primary' | 'outline' | 'ghost' | 'danger'
export type ButtonSize = 'sm' | 'md' | 'lg'

const HEIGHTS: Record<ButtonSize, number> = { sm: 44, md: 48, lg: 56 }

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  icon,
  fullWidth = false,
  style,
}: {
  label: string
  onPress?: () => void
  variant?: ButtonVariant
  size?: ButtonSize
  disabled?: boolean
  loading?: boolean
  icon?: ReactNode
  fullWidth?: boolean
  style?: ViewStyle
}) {
  const colors = useColors()
  const inert = disabled || loading

  const surface: Record<ButtonVariant, ViewStyle> = {
    primary: { backgroundColor: colors.ochre },
    outline: { borderWidth: 1, borderColor: colors.rule },
    ghost: {},
    danger: { backgroundColor: colors.alert },
  }
  const label_: Record<ButtonVariant, string> = {
    primary: colors.onAccent,
    outline: colors.ink,
    ghost: colors.muted,
    danger: colors.ink,
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: inert, busy: loading }}
      disabled={inert}
      onPress={onPress}
      android_ripple={{ color: colors.ruleStrong }}
      style={[
        styles.base,
        { height: HEIGHTS[size] },
        surface[variant],
        fullWidth && styles.fullWidth,
        inert && styles.inert,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={label_[variant]} />
      ) : (
        <View style={styles.inner}>
          {icon}
          <Text style={[text.label, { color: label_[variant] }]}>{label}</Text>
        </View>
      )}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.control,
    paddingHorizontal: space.lg,
    overflow: 'hidden',
  },
  inner: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  fullWidth: { alignSelf: 'stretch' },
  inert: { opacity: 0.5 },
})
