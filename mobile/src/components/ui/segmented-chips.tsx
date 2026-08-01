import { Pressable, StyleSheet, Text, View } from 'react-native'

import { useColors } from '@/theme/theme-provider'
import { radii, space } from '@/theme/tokens'
import { text } from '@/theme/type'

/**
 * The replacement for the dashboard's native `<select>` on small enums.
 *
 * A `<select>` does not port: on Android it becomes a modal wheel that hides
 * the form behind it and takes three interactions to set one value. For an
 * enum of two to seven options, a wrapping row of chips is one tap, shows
 * every option at once, and needs no dependency.
 *
 * (For a 60-hog roster this is the wrong shape entirely — that is what the
 * hog picker screen exists for.)
 */

export type ChipOption<T extends string> = { value: T; label: string }

export function SegmentedChips<T extends string>({
  options,
  value,
  onChange,
  /** Adds an "Any" chip that selects `undefined`. For filters, not for input. */
  allowClear = false,
  clearLabel = 'Any',
}: {
  options: readonly ChipOption<T>[]
  value: T | undefined
  onChange: (value: T | undefined) => void
  allowClear?: boolean
  clearLabel?: string
}) {
  const colors = useColors()

  const chip = (key: string, label: string, selected: boolean, onPress: () => void) => (
    <Pressable
      key={key}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      onPress={onPress}
      android_ripple={{ color: colors.ruleStrong }}
      style={[
        styles.chip,
        selected
          ? { backgroundColor: colors.ochre, borderColor: colors.ochre }
          : { backgroundColor: colors.raised, borderColor: colors.rule },
      ]}
    >
      <Text style={[text.label, { color: selected ? colors.onAccent : colors.ink }]}>{label}</Text>
    </Pressable>
  )

  return (
    <View accessibilityRole="radiogroup" style={styles.row}>
      {allowClear && chip('__any', clearLabel, value === undefined, () => onChange(undefined))}
      {options.map((option) =>
        chip(option.value, option.label, value === option.value, () => onChange(option.value)),
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chip: {
    minHeight: 44,
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: radii.control,
    paddingHorizontal: space.md,
  },
})
