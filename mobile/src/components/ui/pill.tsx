import { StyleSheet, Text, View } from 'react-native'

import { useColors } from '@/theme/theme-provider'
import type { Palette } from '@/theme/tokens'
import { radii } from '@/theme/tokens'
import { text } from '@/theme/type'

/**
 * Status pills, with the tone maps ported verbatim from the dashboard
 * (`hog-badges.tsx`, `alerts-view.tsx`, `settings-view.tsx`).
 *
 * The washes are opaque rather than an alpha of the tone colour, for the
 * reason globals.css records: 15% of a dark hue over a pale surface is
 * dominated by the surface, and in light mode the three washes would composite
 * into three near-identical beiges — leaving a triage list where "open" and
 * "resolved" cannot be told apart.
 */

export type PillTone = 'neutral' | 'gain' | 'alert' | 'ochre'

function toneColors(tone: PillTone, colors: Palette) {
  switch (tone) {
    case 'gain':
      return { backgroundColor: colors.gainWash, color: colors.gain }
    case 'alert':
      return { backgroundColor: colors.alertWash, color: colors.alert }
    case 'ochre':
      return { backgroundColor: colors.ochreWash, color: colors.ochre }
    case 'neutral':
      return { backgroundColor: colors.raised, color: colors.muted }
  }
}

export function Pill({ label, tone = 'neutral' }: { label: string; tone?: PillTone }) {
  const colors = useColors()
  const { backgroundColor, color } = toneColors(tone, colors)
  return (
    <View style={[styles.pill, { backgroundColor }]}>
      <Text style={[text.pill, { color }]}>{label}</Text>
    </View>
  )
}

export const HOG_STATUS_TONE: Record<string, PillTone> = {
  active: 'gain',
  archived: 'neutral',
  deceased: 'alert',
}

export const ALERT_STATUS_TONE: Record<string, PillTone> = {
  open: 'alert',
  acknowledged: 'ochre',
  resolved: 'gain',
}

export const BREEDING_STATUS_TONE: Record<string, PillTone> = {
  ongoing: 'ochre',
  completed: 'gain',
  aborted: 'neutral',
}

/** Viewer reads as neutral; every role that can write reads as the accent. */
export function roleTone(role: string | undefined): PillTone {
  return role === 'viewer' ? 'neutral' : 'ochre'
}

const styles = StyleSheet.create({
  pill: {
    alignSelf: 'flex-start',
    borderRadius: radii.pill,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
})
