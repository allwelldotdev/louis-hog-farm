import type { ReactNode } from 'react'
import { StyleSheet, Text, View, type ViewStyle } from 'react-native'

import { useColors } from '@/theme/theme-provider'
import { radii, space } from '@/theme/tokens'
import { text } from '@/theme/type'

/**
 * The dashboard's card, in px.
 *
 * `rounded-card border border-rule bg-surface`, header `px-5 py-3.5`, body
 * `px-5 py-4`, footer `px-5 py-2` with a top rule.
 *
 * **Border, never shadow.** The web uses `shadow-panel` on exactly two things
 * (toasts and one popover) and cards get their lift from a hairline rule. That
 * is worth preserving beyond consistency: `elevation` on Android forces a
 * separate rendering layer per card, and a scrolling list of them costs frames
 * on the mid-range hardware this app targets.
 */

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  const colors = useColors()
  return (
    <View
      style={[styles.card, { borderColor: colors.rule, backgroundColor: colors.surface }, style]}
    >
      {children}
    </View>
  )
}

export function CardHeader({
  title,
  hint,
  right,
}: {
  title: string
  hint?: string
  right?: ReactNode
}) {
  const colors = useColors()
  return (
    <View style={[styles.header, { borderBottomColor: colors.rule }]}>
      <View style={styles.headerText}>
        <Text style={[text.cardTitle, { color: colors.ink }]}>{title}</Text>
        {hint ? (
          <Text style={[text.meta, styles.hint, { color: colors.muted }]}>{hint}</Text>
        ) : null}
      </View>
      {right}
    </View>
  )
}

export function CardBody({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[styles.body, style]}>{children}</View>
}

export function CardFooter({ children }: { children: ReactNode }) {
  const colors = useColors()
  return <View style={[styles.footer, { borderTopColor: colors.rule }]}>{children}</View>
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: radii.card, overflow: 'hidden' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.lg,
    paddingHorizontal: space.xl,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  headerText: { flex: 1 },
  hint: { marginTop: 2 },
  body: { paddingHorizontal: space.xl, paddingVertical: space.lg },
  footer: { paddingHorizontal: space.xl, paddingVertical: space.sm, borderTopWidth: 1 },
})
