import { useLocalSearchParams, useRouter } from 'expo-router'
import { Scale, Syringe, Wheat } from 'lucide-react-native'
import { StyleSheet, Text, View } from 'react-native'

import { HogSparkline } from '@/components/hog-sparkline'
import { Button } from '@/components/ui/button'
import { Card, CardBody, CardFooter, CardHeader } from '@/components/ui/card'
import { Banner, EmptyState, Skeleton } from '@/components/ui/feedback'
import { Locked } from '@/components/ui/locked'
import { HOG_STATUS_TONE, Pill } from '@/components/ui/pill'
import { Screen, ScreenHeader } from '@/components/ui/screen'
import { useFarm, usePermissions } from '@/hooks/use-farm'
import { useHog, useHogGrowth, useHogTags } from '@/hooks/use-hogs'
import { useFeedRecords, useHealthRecords, useVaccinations } from '@/hooks/use-records'
import { errorMessage } from '@/lib/api/errors'
import type { Hog } from '@/lib/api/types'
import { deviceToday, formatBusinessDate, formatMoney, formatNumber, humanize } from '@/lib/format'
import { useColors } from '@/theme/theme-provider'
import { space } from '@/theme/tokens'
import { eyebrow, figure, figureSize, text } from '@/theme/type'

/** Enough to see a trend; the dashboard is where the full history lives. */
const RECENT = 3

export default function HogDetail() {
  const colors = useColors()
  const router = useRouter()
  const params = useLocalSearchParams<{ hogId: string }>()
  const hogId = Number(params.hogId)

  const { data: hog, isPending, error } = useHog(hogId)
  const growth = useHogGrowth(hogId)
  const { canWrite } = usePermissions()

  if (isPending) {
    return (
      <Screen>
        <Skeleton height={120} />
        <Skeleton height={200} />
      </Screen>
    )
  }

  if (error || !hog) {
    return (
      <Screen>
        <ScreenHeader section="Herd" title="Hog" />
        <Banner tone="alert" message={error ? errorMessage(error) : 'That hog was not found.'} />
        <Button label="Back" variant="outline" onPress={() => router.back()} />
      </Screen>
    )
  }

  return (
    <Screen>
      <ScreenHeader
        section={`${hog.breed} · ${humanize(hog.production_class)}`}
        title={hog.tag_number}
        right={
          <Pill label={humanize(hog.status)} tone={HOG_STATUS_TONE[hog.status] ?? 'neutral'} />
        }
      />

      {/* Two taps from the roster to a recorded weigh-in, skipping the picker
          entirely — the fastest path in the app once you have the animal. */}
      <Locked when={!canWrite} role="worker" can="you can view this animal but not add records">
        <View style={styles.actions}>
          <Button
            label="Weigh in"
            size="sm"
            icon={<Scale size={16} color={colors.onAccent} />}
            onPress={() => router.push(`/capture/health-record?hogId=${hog.id}&mode=weigh`)}
          />
          <Button
            label="Feed"
            size="sm"
            variant="outline"
            icon={<Wheat size={16} color={colors.ink} />}
            onPress={() => router.push(`/capture/feed?hogId=${hog.id}`)}
          />
          <Button
            label="Vaccinate"
            size="sm"
            variant="outline"
            icon={<Syringe size={16} color={colors.ink} />}
            onPress={() => router.push(`/capture/vaccination?hogId=${hog.id}`)}
          />
        </View>
      </Locked>

      <Card>
        <CardHeader title="Growth" hint="Weigh-ins, most recent last" />
        <CardBody>
          {growth.isPending ? (
            <Skeleton height={96} />
          ) : growth.error ? (
            <Banner tone="alert" message={errorMessage(growth.error)} />
          ) : (
            <HogSparkline points={growth.data?.actual ?? []} />
          )}
        </CardBody>
      </Card>

      <Details hog={hog} />
      <RecentWeighIns hogId={hog.id} />
      <RecentFeed hogId={hog.id} />
      <VaccinationsCard hogId={hog.id} />
    </Screen>
  )
}

function Details({ hog }: { hog: Hog }) {
  const colors = useColors()
  const tags = useHogTags()

  // Parents are stored as ids; the ear tag is what is written on the animal.
  const parent = (id: number | null | undefined) =>
    id === null || id === undefined ? 'Not recorded' : (tags.get(id) ?? `#${id}`)

  return (
    <Card>
      <CardHeader title="Details" />
      <CardBody>
        <View style={styles.detailGrid}>
          <Detail
            label="Born"
            value={formatBusinessDate(hog.birth_date, { dateStyle: 'medium' })}
          />
          <Detail label="Sex" value={humanize(hog.sex)} />
          <Detail label="Dam" value={parent(hog.dam_id)} />
          <Detail label="Sire" value={parent(hog.sire_id)} />
        </View>
      </CardBody>
      <CardFooter>
        <Text style={[text.meta, { color: colors.muted }]}>
          Lineage and edits are on the web dashboard.
        </Text>
      </CardFooter>
    </Card>
  )
}

function Detail({ label, value }: { label: string; value: string }) {
  const colors = useColors()
  return (
    <View style={styles.detail}>
      <Text style={[eyebrow, { color: colors.muted }]}>{label}</Text>
      <Text style={[text.body, { color: colors.ink }]}>{value}</Text>
    </View>
  )
}

function RecentWeighIns({ hogId }: { hogId: number }) {
  const colors = useColors()
  const { data, isPending } = useHealthRecords({ hog_id: hogId, limit: RECENT })

  return (
    <Card>
      <CardHeader title="Recent weigh-ins" />
      <CardBody>
        {isPending ? (
          <Skeleton height={64} />
        ) : (data?.items.length ?? 0) === 0 ? (
          <EmptyState message="No weigh-ins yet." />
        ) : (
          <View style={styles.rows}>
            {data?.items.map((record) => (
              <View key={record.id} style={styles.row}>
                <Text style={[text.meta, styles.flex, { color: colors.muted }]}>
                  {formatBusinessDate(record.record_date, { dateStyle: 'medium' })}
                </Text>
                {/* `weight` arrives as a Decimal *string*; formatNumber parses. */}
                <Text style={[figure(figureSize.sm), { color: colors.ink }]}>
                  {formatNumber(record.weight, 1)} kg
                </Text>
                {record.temperature ? (
                  <Text style={[text.meta, { color: colors.muted }]}>
                    {formatNumber(record.temperature, 1)} °C
                  </Text>
                ) : null}
              </View>
            ))}
          </View>
        )}
      </CardBody>
    </Card>
  )
}

function RecentFeed({ hogId }: { hogId: number }) {
  const colors = useColors()
  const { data, isPending } = useFeedRecords({ hog_id: hogId, limit: RECENT })
  const farm = useFarm()

  return (
    <Card>
      <CardHeader title="Recent feed" />
      <CardBody>
        {isPending ? (
          <Skeleton height={64} />
        ) : (data?.items.length ?? 0) === 0 ? (
          <EmptyState message="No feed recorded yet." />
        ) : (
          <View style={styles.rows}>
            {data?.items.map((record) => (
              <View key={record.id} style={styles.row}>
                <Text style={[text.meta, styles.flex, { color: colors.muted }]}>
                  {formatBusinessDate(record.record_date, { dateStyle: 'medium' })}
                </Text>
                <Text style={[figure(figureSize.sm), { color: colors.ink }]}>
                  {formatNumber(record.feed_amount, 1)} kg
                </Text>
                <Text style={[text.meta, { color: colors.muted }]}>
                  {/* Stamped per row at write time, so a historical record keeps
                      the currency it was entered in. */}
                  {formatMoney(
                    record.feed_cost,
                    record.currency_code || (farm.data?.currency_code ?? ''),
                  )}
                </Text>
              </View>
            ))}
          </View>
        )}
      </CardBody>
    </Card>
  )
}

function VaccinationsCard({ hogId }: { hogId: number }) {
  const colors = useColors()
  const { data, isPending } = useVaccinations({ hog_id: hogId })
  const today = deviceToday()
  const doses = data?.total ?? 0

  return (
    <Card>
      <CardHeader
        title="Vaccinations"
        hint={isPending ? undefined : `${doses} ${doses === 1 ? 'dose' : 'doses'}`}
      />
      <CardBody>
        {isPending ? (
          <Skeleton height={48} />
        ) : (data?.items.length ?? 0) === 0 ? (
          <EmptyState message="No vaccinations recorded." />
        ) : (
          <View style={styles.rows}>
            {data?.items.slice(0, RECENT).map((dose) => {
              // Same treatment the alerts page and the dashboard use.
              const overdue = dose.next_due_date !== null && (dose.next_due_date ?? '') <= today
              return (
                <View key={dose.id} style={styles.row}>
                  <Text style={[text.meta, styles.flex, { color: colors.ink }]} numberOfLines={1}>
                    {dose.vaccine_name}
                  </Text>
                  <Text style={[text.meta, { color: overdue ? colors.alert : colors.muted }]}>
                    {formatBusinessDate(dose.dose_date)}
                    {overdue ? ' · overdue' : ''}
                  </Text>
                </View>
              )
            })}
          </View>
        )}
      </CardBody>
    </Card>
  )
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  detailGrid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: space.lg, columnGap: space.lg },
  detail: { flexBasis: '45%', flexGrow: 1, gap: 2 },
  rows: { gap: space.md },
  row: { flexDirection: 'row', alignItems: 'baseline', gap: space.md },
  flex: { flex: 1 },
})
