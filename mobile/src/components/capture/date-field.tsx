import { useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'

import { Field, Input } from '@/components/ui/field'
import { SegmentedChips } from '@/components/ui/segmented-chips'
import { addDays, formatBusinessDate, isFutureDate } from '@/lib/format'
import { useColors } from '@/theme/theme-provider'
import { space } from '@/theme/tokens'
import { text } from '@/theme/type'

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

/**
 * A date, without a date-picker dependency.
 *
 * Effectively every field entry is same-day, so the default is today and the
 * common case is zero interactions. "Other" opens a plain `YYYY-MM-DD` field
 * rather than a modal wheel, which is faster for the rare backdated entry and
 * costs nothing to ship.
 *
 * `today` is the farm's date, taken from the server (`kpis.date_to`) rather
 * than the device clock — see `useFarmToday`. The backend rejects a future
 * `record_date` against the farm's timezone, so validating against anything
 * else produces a 400 the user cannot explain.
 */
export function DateField({
  label,
  value,
  onChange,
  today,
  allowFuture = false,
  error,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  today: string
  /** Only `next_due_date` on a vaccination, which is a forward date by nature. */
  allowFuture?: boolean
  error?: string
}) {
  const colors = useColors()
  const yesterday = addDays(today, -1)
  const preset = value === today ? 'today' : value === yesterday ? 'yesterday' : 'other'
  const [showOther, setShowOther] = useState(preset === 'other')

  const malformed = value.length > 0 && !ISO_DATE.test(value)
  const future = !allowFuture && ISO_DATE.test(value) && isFutureDate(value, today)
  const problem =
    error ??
    (malformed ? 'Use the form YYYY-MM-DD.' : future ? 'That date is in the future.' : undefined)

  return (
    <Field
      label={label}
      error={problem}
      hint={problem ? undefined : formatBusinessDate(value, { dateStyle: 'full' })}
    >
      <View style={styles.stack}>
        <SegmentedChips
          options={[
            { value: 'today' as const, label: 'Today' },
            { value: 'yesterday' as const, label: 'Yesterday' },
            { value: 'other' as const, label: 'Other' },
          ]}
          value={preset}
          onChange={(next) => {
            if (next === 'today') {
              setShowOther(false)
              onChange(today)
            } else if (next === 'yesterday') {
              setShowOther(false)
              onChange(yesterday)
            } else {
              setShowOther(true)
            }
          }}
        />
        {showOther || preset === 'other' ? (
          <Input
            value={value}
            onChangeText={onChange}
            placeholder="2026-08-01"
            keyboardType="numbers-and-punctuation"
            autoCorrect={false}
            invalid={Boolean(problem)}
          />
        ) : null}
        {allowFuture ? (
          <Text style={[text.meta, { color: colors.muted }]}>A future date is fine here.</Text>
        ) : null}
      </View>
    </Field>
  )
}

const styles = StyleSheet.create({
  stack: { gap: space.sm },
})
