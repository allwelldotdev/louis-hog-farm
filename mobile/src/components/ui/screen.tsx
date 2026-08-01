import type { ReactNode } from 'react'
import { ScrollView, StyleSheet, Text, View, type ViewStyle } from 'react-native'
import { SafeAreaView, type Edge } from 'react-native-safe-area-context'

import { useColors } from '@/theme/theme-provider'
import { space } from '@/theme/tokens'
import { eyebrow, text } from '@/theme/type'

/**
 * Every route's outer wrapper: safe area, page background, consistent padding.
 *
 * `keyboardShouldPersistTaps="handled"` is not a detail. Without it, the first
 * tap on a Save button while the keyboard is up only dismisses the keyboard,
 * and the user has to tap twice — which on a form reads as the button being
 * broken.
 */
export function Screen({
  children,
  scroll = true,
  edges = ['top'],
  contentStyle,
}: {
  children: ReactNode
  scroll?: boolean
  edges?: Edge[]
  contentStyle?: ViewStyle
}) {
  const colors = useColors()
  const body = scroll ? (
    <ScrollView
      contentContainerStyle={[styles.content, contentStyle]}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.content, styles.flex, contentStyle]}>{children}</View>
  )

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: colors.ground }]} edges={edges}>
      {body}
    </SafeAreaView>
  )
}

/** The dashboard's page heading: an eyebrow, then the title. */
export function ScreenHeader({
  section,
  title,
  right,
}: {
  section: string
  title: string
  right?: ReactNode
}) {
  const colors = useColors()
  return (
    <View style={styles.header}>
      <View style={styles.flex}>
        <Text style={[eyebrow, { color: colors.muted }]}>{section}</Text>
        <Text style={[text.h1, styles.title, { color: colors.ink }]}>{title}</Text>
      </View>
      {right}
    </View>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: space.lg, gap: space.lg, paddingBottom: space.xxl },
  header: { flexDirection: 'row', alignItems: 'flex-end', gap: space.md },
  title: { marginTop: 2 },
})
