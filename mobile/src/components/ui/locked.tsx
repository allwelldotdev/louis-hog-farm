import * as Haptics from 'expo-haptics'
import { Lock } from 'lucide-react-native'
import type { ReactNode } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import { useColors } from '@/theme/theme-provider'
import { radii, space } from '@/theme/tokens'
import { text } from '@/theme/type'

/**
 * Present-but-locked — a deliberate divergence from the web dashboard.
 *
 * On the dashboard a forbidden action is **absent**: "a greyed-out button
 * still advertises an action they will never be able to take." That is right
 * for a manager's desk, where the person looking at the screen is usually the
 * person who can change the permission.
 *
 * On the phone it is wrong. The user is a worker, the person who can grant the
 * permission is somewhere else, and a capability they cannot see is one they
 * cannot know to ask for. So the flow stays on screen and states the rule.
 *
 * The asymmetry this exploits: `GET` on mortality, breeding and alerts is
 * `CurrentUser`, so everyone genuinely reads them — only the write is
 * manager-gated. A locked screen here is a useful read screen with a disabled
 * button, not an empty shell. (`GET /users` is the one exception, hence
 * `LockedNotice` for a locked *read*.)
 *
 * Copy formula, applied everywhere: "<Role> only — <what you can still do>."
 * Never a bare "Forbidden".
 */

export type LockRole = 'manager' | 'worker'

const ROLE_LABEL: Record<LockRole, string> = {
  manager: 'Manager',
  worker: 'Worker',
}

function lockMessage(role: LockRole, can: string) {
  return `${ROLE_LABEL[role]} only — ${can}.`
}

/**
 * Wraps one control or one form.
 *
 * `pointerEvents="none"` on the children rather than `disabled` on each: the
 * wrapped thing might be a whole form, and this way it neither has to know it
 * is locked nor thread a disabled prop through every input.
 *
 * The tap still fires a selection haptic. Tapping something that does nothing
 * at all reads as a broken app; an acknowledged tap next to a sentence
 * explaining why reads as a rule.
 */
export function Locked({
  when,
  role,
  can,
  children,
}: {
  when: boolean
  role: LockRole
  can: string
  children: ReactNode
}) {
  const colors = useColors()

  if (!when) return <>{children}</>

  return (
    <View style={styles.wrap}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: true }}
        accessibilityHint={lockMessage(role, can)}
        onPress={() => Haptics.selectionAsync()}
      >
        <View pointerEvents="none" style={styles.dimmed}>
          {children}
        </View>
      </Pressable>
      <View style={styles.reason}>
        <Lock size={14} color={colors.muted} />
        <Text style={[text.meta, styles.flex, { color: colors.muted }]}>
          {lockMessage(role, can)}
        </Text>
      </View>
    </View>
  )
}

/**
 * The screen-level form, for a panel that cannot be read at all.
 *
 * There is exactly one of these in the app: the staff roster, because
 * `GET /users` is manager-gated. Everything else locks the write and shows the
 * data.
 */
export function LockedNotice({ role, can }: { role: LockRole; can: string }) {
  const colors = useColors()
  return (
    <View style={[styles.notice, { backgroundColor: colors.ochreWash }]}>
      <Lock size={16} color={colors.ochre} />
      <Text style={[text.meta, styles.flex, { color: colors.ochre }]}>
        {lockMessage(role, can)}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { gap: space.sm },
  dimmed: { opacity: 0.45 },
  reason: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  flex: { flex: 1 },
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    borderRadius: radii.control,
    padding: space.md,
  },
})
