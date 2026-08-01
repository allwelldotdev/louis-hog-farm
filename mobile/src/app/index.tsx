import { Scale, Syringe } from 'lucide-react-native'
import { useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'

import { Button } from '@/components/ui/button'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { Banner, EmptyState, Skeleton } from '@/components/ui/feedback'
import { Field, Input } from '@/components/ui/field'
import { Locked, LockedNotice } from '@/components/ui/locked'
import { Pill } from '@/components/ui/pill'
import { Screen, ScreenHeader } from '@/components/ui/screen'
import { SegmentedChips } from '@/components/ui/segmented-chips'
import { useTheme } from '@/theme/theme-provider'
import { space } from '@/theme/tokens'
import { THEME_LABELS, type ThemePreference } from '@/theme/preference'
import { eyebrow, figure, figureSize, text } from '@/theme/type'

/**
 * Design-system showcase — temporary, replaced by the boot route in P3.
 *
 * It exists so P1 can be verified on a real device rather than asserted: one
 * of every primitive, in both palettes, at real sizes.
 */
export default function Showcase() {
  const { colors, preference, setTheme } = useTheme()
  const [weight, setWeight] = useState('')
  const [sex, setSex] = useState<'male' | 'female' | undefined>('female')

  return (
    <Screen>
      <ScreenHeader section="Design system" title="Bright Acres" />

      <Card>
        <CardHeader title="Theme" hint="System is stored as the absence of a key" />
        <CardBody>
          <SegmentedChips
            options={(['system', 'light', 'dark'] as ThemePreference[]).map((value) => ({
              value,
              label: THEME_LABELS[value],
            }))}
            value={preference}
            onChange={(value) => setTheme(value ?? 'system')}
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Figures" hint="Tabular, semibold, tightened" />
        <CardBody>
          <View style={styles.row}>
            <Metric label="Active hogs" value="61" tone={colors.ink} />
            <Metric label="Avg daily gain" value="0.42" tone={colors.gain} />
            <Metric label="Open alerts" value="2" tone={colors.alert} />
          </View>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Inputs" />
        <CardBody>
          <View style={styles.stack}>
            <Field label="Weight" suffix="kg" hint="Recorded against today's date">
              <Input
                value={weight}
                onChangeText={setWeight}
                keyboardType="decimal-pad"
                placeholder="0.0"
              />
            </Field>
            <Field label="Sex">
              <SegmentedChips
                options={[
                  { value: 'female' as const, label: 'Female' },
                  { value: 'male' as const, label: 'Male' },
                ]}
                value={sex}
                onChange={setSex}
              />
            </Field>
          </View>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Buttons and pills" />
        <CardBody>
          <View style={styles.stack}>
            <Button
              label="Save weigh-in"
              size="lg"
              fullWidth
              icon={<Scale size={18} color={colors.onAccent} />}
            />
            <View style={styles.row}>
              <Button label="Cancel" variant="outline" />
              <Button
                label="Vaccinate"
                variant="ghost"
                icon={<Syringe size={18} color={colors.muted} />}
              />
            </View>
            <Button label="Record a death" variant="danger" />
            <View style={styles.pills}>
              <Pill label="Active" tone="gain" />
              <Pill label="Archived" tone="neutral" />
              <Pill label="Deceased" tone="alert" />
              <Pill label="Acknowledged" tone="ochre" />
            </View>
          </View>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="States" />
        <CardBody>
          <View style={styles.stack}>
            <Banner tone="alert" message="Could not save. Check the connection and try again." />
            <Skeleton height={48} />
            <EmptyState message="This animal has never been weighed." />
          </View>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Present-but-locked" hint="The divergence from the dashboard" />
        <CardBody>
          <View style={styles.stack}>
            <Locked when role="manager" can="view mortality records but not add them">
              <Button label="Record a death" variant="outline" fullWidth />
            </Locked>
            <LockedNotice role="manager" can="staff accounts are managed by your farm's manager" />
          </View>
        </CardBody>
      </Card>
    </Screen>
  )
}

function Metric({ label, value, tone }: { label: string; value: string; tone: string }) {
  const { colors } = useTheme()
  return (
    <View style={styles.metric}>
      <Text style={[eyebrow, { color: colors.muted }]}>{label}</Text>
      <Text style={[figure(figureSize.lg), styles.metricValue, { color: tone }]}>{value}</Text>
      <Text style={[text.meta, { color: colors.muted }]}>seeded farm</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: space.md, flexWrap: 'wrap' },
  stack: { gap: space.lg },
  pills: { flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' },
  metric: { flex: 1, minWidth: 90 },
  metricValue: { marginTop: 6 },
})
