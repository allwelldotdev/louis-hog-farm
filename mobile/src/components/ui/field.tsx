import { forwardRef, useState, type ReactNode } from 'react'
import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native'

import { useColors } from '@/theme/theme-provider'
import { radii, space } from '@/theme/tokens'
import { eyebrow, text } from '@/theme/type'

/**
 * Label -> control -> error OR hint, as on the dashboard.
 *
 * Error and hint are mutually exclusive there and stay so here: showing both
 * puts two competing instructions under one input.
 */
export function Field({
  label,
  error,
  hint,
  suffix,
  children,
}: {
  label: string
  error?: string
  hint?: string
  /** A static unit or currency code shown beside the control. */
  suffix?: string
  children: ReactNode
}) {
  const colors = useColors()
  return (
    <View style={styles.field}>
      <Text style={[eyebrow, { color: colors.muted }]}>{label}</Text>
      {suffix ? (
        <View style={styles.row}>
          <View style={styles.flex}>{children}</View>
          <Text style={[text.body, { color: colors.muted }]}>{suffix}</Text>
        </View>
      ) : (
        children
      )}
      {error ? (
        <Text accessibilityRole="alert" style={[text.meta, { color: colors.alert }]}>
          {error}
        </Text>
      ) : hint ? (
        <Text style={[text.meta, { color: colors.muted }]}>{hint}</Text>
      ) : null}
    </View>
  )
}

/**
 * Height 52 and fontSize 16 — both deliberate.
 *
 * 16 is the threshold below which Android offers to zoom a text field, and a
 * worker squinting at a 13px input in sunlight is the failure this app exists
 * to avoid.
 *
 * The focus ring is a border colour change rather than an outline: React
 * Native has no `:focus-visible`, and a shadow would cost a render layer.
 */
export const Input = forwardRef<TextInput, TextInputProps & { invalid?: boolean }>(function Input(
  { invalid = false, style, onFocus, onBlur, ...props },
  ref,
) {
  const colors = useColors()
  const [focused, setFocused] = useState(false)

  const borderColor = invalid ? colors.alert : focused ? colors.ochre : colors.rule

  return (
    <TextInput
      ref={ref}
      placeholderTextColor={colors.muted}
      selectionColor={colors.ochre}
      onFocus={(event) => {
        setFocused(true)
        onFocus?.(event)
      }}
      onBlur={(event) => {
        setFocused(false)
        onBlur?.(event)
      }}
      style={[
        styles.input,
        text.body,
        { borderColor, backgroundColor: colors.raised, color: colors.ink },
        style,
      ]}
      {...props}
    />
  )
})

const styles = StyleSheet.create({
  field: { gap: space.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  flex: { flex: 1 },
  input: {
    height: 52,
    borderWidth: 1,
    borderRadius: radii.control,
    paddingHorizontal: space.md,
  },
})
