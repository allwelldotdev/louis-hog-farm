import { useRouter } from 'expo-router'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import { CaptureGrid } from '@/components/capture-grid'
import { Card, CardBody, CardFooter, CardHeader } from '@/components/ui/card'
import { Banner, Skeleton } from '@/components/ui/feedback'
import { Screen, ScreenHeader } from '@/components/ui/screen'
import { useFarm, useKpis } from '@/hooks/use-farm'
import { errorMessage } from '@/lib/api/errors'
import { NO_VALUE, formatInteger, formatNumber } from '@/lib/format'
import { useColors } from '@/theme/theme-provider'
import { space } from '@/theme/tokens'
import { eyebrow, figure, figureSize, text } from '@/theme/type'

/**
 * Today: what to record, then how the herd is doing.
 *
 * The analytics here stop at four figures, on purpose. The brief is explicit
 * that real analysis belongs on the web dashboard, and the footer says so
 * rather than leaving the absence to be discovered.
 */
export default function Today() {
  const colors = useColors()
  const farm = useFarm()
  const kpis = useKpis()

  return (
    <Screen>
      <ScreenHeader section={farm.data?.name ?? 'Farm'} title="Today" />

      <CaptureGrid />

      <Card>
        <CardHeader title="The herd" hint={kpis.data ? `As at ${kpis.data.date_to}` : undefined} />
        <CardBody>
          {kpis.isPending ? (
            <Skeleton height={72} />
          ) : kpis.error ? (
            <Banner tone="alert" message={errorMessage(kpis.error)} />
          ) : kpis.data ? (
            <View style={styles.grid}>
              <Metric label="Active hogs" value={formatInteger(kpis.data.active_hogs_count)} />
              <Metric
                label="Avg daily gain"
                value={formatNumber(kpis.data.avg_daily_gain_kg)}
                unit="kg/day"
                tone={
                  kpis.data.avg_daily_gain_kg === null
                    ? undefined
                    : kpis.data.avg_daily_gain_kg >= 0
                      ? colors.gain
                      : colors.alert
                }
              />
              <Metric label="Market ready" value={formatInteger(kpis.data.market_ready_count)} />
              <AlertsMetric count={kpis.data.open_alerts_count} />
            </View>
          ) : null}
        </CardBody>
        <CardFooter>
          <Text style={[text.meta, { color: colors.muted }]}>
            Full analysis is on the web dashboard.
          </Text>
        </CardFooter>
      </Card>
    </Screen>
  )
}

function AlertsMetric({ count }: { count: number }) {
  const colors = useColors()
  const router = useRouter()
  return (
    <Pressable style={styles.metric} onPress={() => router.push('/alerts')}>
      <Metric
        label="Open alerts"
        value={formatInteger(count)}
        tone={count > 0 ? colors.alert : undefined}
        bare
      />
    </Pressable>
  )
}

function Metric({
  label,
  value,
  unit,
  tone,
  bare = false,
}: {
  label: string
  value: string
  unit?: string
  tone?: string
  bare?: boolean
}) {
  const colors = useColors()
  return (
    <View style={bare ? undefined : styles.metric}>
      <Text style={[eyebrow, { color: colors.muted }]}>{label}</Text>
      <View style={styles.valueRow}>
        <Text style={[figure(figureSize.lg), { color: tone ?? colors.ink }]}>{value}</Text>
        {/* A unit beside an em dash would read as "— kg/day", which claims a
            measurement that was never taken. */}
        {unit && value !== NO_VALUE ? (
          <Text style={[text.meta, { color: colors.muted }]}>{unit}</Text>
        ) : null}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: space.xl, columnGap: space.lg },
  metric: { flexBasis: '45%', flexGrow: 1, gap: 4 },
  valueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
})
