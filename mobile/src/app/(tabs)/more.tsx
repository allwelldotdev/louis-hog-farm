import { useRouter } from 'expo-router'
import {
  Baby,
  ChevronRight,
  Lock,
  Server,
  Settings,
  Skull,
  Users,
  type LucideIcon,
} from 'lucide-react-native'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { Pill, roleTone } from '@/components/ui/pill'
import { Screen, ScreenHeader } from '@/components/ui/screen'
import { useCurrentUser, useFarm, usePermissions } from '@/hooks/use-farm'
import { ROLE_LABELS } from '@/lib/auth/permissions'
import { useColors } from '@/theme/theme-provider'
import { radii, space } from '@/theme/tokens'
import { eyebrow, text } from '@/theme/type'

type Row = {
  href: string
  label: string
  hint: string
  icon: LucideIcon
  /** Rendered with a padlock for anyone below this bar. */
  managerOnly?: boolean
}

const ROWS: Row[] = [
  {
    href: '/manage/breeding',
    label: 'Breeding',
    hint: 'Cycles and farrowing dates',
    icon: Baby,
    managerOnly: true,
  },
  {
    href: '/manage/mortality',
    label: 'Mortality',
    hint: 'Recorded deaths',
    icon: Skull,
    managerOnly: true,
  },
  {
    href: '/settings/staff',
    label: 'Staff',
    hint: 'Who can sign in',
    icon: Users,
    managerOnly: true,
  },
  { href: '/settings', label: 'Settings', hint: 'Account, theme, farm', icon: Settings },
  { href: '/server', label: 'Server address', hint: 'Where the data lives', icon: Server },
]

/**
 * The overflow tab.
 *
 * Manager destinations carry a padlock glyph *before* the tap rather than only
 * after it, so the lock is discoverable rather than a dead end someone walks
 * into. They are still listed for everyone — that is the whole present-but-
 * locked argument.
 */
export default function More() {
  const colors = useColors()
  const user = useCurrentUser()
  const farm = useFarm()
  const { canManage } = usePermissions()

  return (
    <Screen>
      <ScreenHeader section="Account" title="More" />

      <Card>
        <CardHeader title={user.data?.full_name ?? 'Signed in'} hint={user.data?.email} />
        <CardBody>
          <View style={styles.identity}>
            <View style={styles.flex}>
              <Text style={[eyebrow, { color: colors.muted }]}>Farm</Text>
              <Text style={[text.body, { color: colors.ink }]}>{farm.data?.name ?? '—'}</Text>
            </View>
            {user.data ? (
              <Pill label={ROLE_LABELS[user.data.role]} tone={roleTone(user.data.role)} />
            ) : null}
          </View>
        </CardBody>
      </Card>

      <View style={styles.rows}>
        {ROWS.map((row) => (
          <NavRow key={row.href} row={row} locked={Boolean(row.managerOnly) && !canManage} />
        ))}
      </View>
    </Screen>
  )
}

function NavRow({ row, locked }: { row: Row; locked: boolean }) {
  const colors = useColors()
  const router = useRouter()
  const Icon = row.icon

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityHint={locked ? 'Manager only — you can view but not change' : undefined}
      onPress={() => router.push(row.href as never)}
      android_ripple={{ color: colors.ruleStrong }}
      style={[styles.row, { borderColor: colors.rule, backgroundColor: colors.surface }]}
    >
      <Icon size={20} color={colors.muted} />
      <View style={styles.flex}>
        <Text style={[text.bodyMedium, { color: colors.ink }]}>{row.label}</Text>
        <Text style={[text.meta, { color: colors.muted }]}>{row.hint}</Text>
      </View>
      {locked ? <Lock size={16} color={colors.muted} /> : null}
      <ChevronRight size={18} color={colors.muted} />
    </Pressable>
  )
}

const styles = StyleSheet.create({
  identity: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  flex: { flex: 1, gap: 2 },
  rows: { gap: space.sm },
  row: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    borderWidth: 1,
    borderRadius: radii.control,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    overflow: 'hidden',
  },
})
