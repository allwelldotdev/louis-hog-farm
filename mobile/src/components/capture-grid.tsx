import { useRouter } from 'expo-router'
import { HeartPulse, Scale, Syringe, Wheat, type LucideIcon } from 'lucide-react-native'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import { Locked } from '@/components/ui/locked'
import { usePermissions } from '@/hooks/use-farm'
import { useColors } from '@/theme/theme-provider'
import { radii, space } from '@/theme/tokens'
import { text } from '@/theme/type'

/**
 * The four capture actions, as a 2x2 grid of large tiles at the top of Today.
 *
 * This is the app's centre of gravity. The brief calls the mobile app "the
 * core input data source", so the first thing on screen at cold open is not a
 * summary of the herd — it is the four things a worker walks into a barn to
 * record. Tiles rather than a list because a tile is a bigger target, and big
 * targets are the whole accessibility story for someone wearing gloves.
 *
 * Weigh-in and Health check are the same endpoint (`POST /health-records`
 * carries weight, temperature and notes) and so the same screen, distinguished
 * by a `mode` param: one focuses the scale reading, the other the thermometer.
 */

type Tile = { key: string; label: string; icon: LucideIcon; href: string }

const TILES: Tile[] = [
  { key: 'weigh', label: 'Weigh-in', icon: Scale, href: '/capture/pick-hog?next=weigh' },
  { key: 'feed', label: 'Feed', icon: Wheat, href: '/capture/pick-hog?next=feed' },
  {
    key: 'vaccine',
    label: 'Vaccination',
    icon: Syringe,
    href: '/capture/pick-hog?next=vaccination',
  },
  { key: 'check', label: 'Health check', icon: HeartPulse, href: '/capture/pick-hog?next=check' },
]

export function CaptureGrid() {
  const { canWrite } = usePermissions()

  return (
    <Locked when={!canWrite} role="worker" can="you can view records but not add them">
      <View style={styles.grid}>
        {TILES.map((tile) => (
          <CaptureTile key={tile.key} tile={tile} />
        ))}
      </View>
    </Locked>
  )
}

function CaptureTile({ tile }: { tile: Tile }) {
  const colors = useColors()
  const router = useRouter()
  const Icon = tile.icon

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={tile.label}
      onPress={() => router.push(tile.href as never)}
      android_ripple={{ color: colors.ruleStrong }}
      style={[styles.tile, { backgroundColor: colors.surface, borderColor: colors.rule }]}
    >
      <Icon size={28} color={colors.ochre} />
      <Text style={[text.label, { color: colors.ink }]}>{tile.label}</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  tile: {
    // Two per row, accounting for the gap.
    flexBasis: '47%',
    flexGrow: 1,
    height: 96,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    borderWidth: 1,
    borderRadius: radii.card,
    overflow: 'hidden',
  },
})
