import { useRouter } from 'expo-router'
import { useState } from 'react'
import { FlatList, StyleSheet, Text, View } from 'react-native'

import { api } from '@/api-runtime'
import { DateField } from '@/components/capture/date-field'
import { Button } from '@/components/ui/button'
import { Banner, EmptyState, Skeleton } from '@/components/ui/feedback'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { Locked } from '@/components/ui/locked'
import { BREEDING_STATUS_TONE, Pill } from '@/components/ui/pill'
import { Screen, ScreenHeader } from '@/components/ui/screen'
import { SegmentedChips } from '@/components/ui/segmented-chips'
import { useFarmToday, usePermissions } from '@/hooks/use-farm'
import { useFarmMutation } from '@/hooks/use-farm-mutation'
import { useHogTags } from '@/hooks/use-hogs'
import { useBreedingCycles } from '@/hooks/use-records'
import { errorMessage } from '@/lib/api/errors'
import type { BreedingCycle } from '@/lib/api/types'
import { addDays, formatBusinessDate, humanize } from '@/lib/format'
import { useColors } from '@/theme/theme-provider'
import { radii, space } from '@/theme/tokens'
import { text } from '@/theme/type'

/** Gestation, the figure the dashboard derives its farrowing date from. */
const GESTATION_DAYS = 114

/** The only two statuses `PATCH /breeding-cycles/{id}` will transition to. */
const CLOSE_OPTIONS = [
  { value: 'completed' as const, label: 'Farrowed' },
  { value: 'aborted' as const, label: 'Aborted' },
]

export default function Breeding() {
  const router = useRouter()
  const { canManage } = usePermissions()
  const { data, isPending, error } = useBreedingCycles()
  const tags = useHogTags()
  const [closing, setClosing] = useState<BreedingCycle | null>(null)

  return (
    <Screen scroll={false}>
      <View style={styles.header}>
        <ScreenHeader section="Herd" title="Breeding" />
        <Locked
          when={!canManage}
          role="manager"
          can="you can view cycles but not open or close them"
        >
          <Button
            label="Open a cycle"
            variant="outline"
            fullWidth
            onPress={() => router.push('/capture/pick-hog?next=breeding&restrictTo=breeding')}
          />
        </Locked>
      </View>

      {isPending ? (
        <View style={styles.stack}>
          <Skeleton height={88} />
          <Skeleton height={88} />
        </View>
      ) : error ? (
        <View style={styles.stack}>
          <Banner tone="alert" message={errorMessage(error)} />
        </View>
      ) : (
        <FlatList
          data={data?.items ?? []}
          keyExtractor={(cycle) => String(cycle.id)}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <Row
              cycle={item}
              tag={tags.get(item.hog_id)}
              canManage={canManage}
              onClose={() => setClosing(item)}
            />
          )}
          ListEmptyComponent={<EmptyState message="No breeding cycles recorded." />}
        />
      )}

      {closing ? (
        <CloseCycle
          cycle={closing}
          tag={tags.get(closing.hog_id)}
          onDone={() => setClosing(null)}
        />
      ) : null}
    </Screen>
  )
}

function Row({
  cycle,
  tag,
  canManage,
  onClose,
}: {
  cycle: BreedingCycle
  tag: string | undefined
  canManage: boolean
  onClose: () => void
}) {
  const colors = useColors()
  const ongoing = cycle.status === 'ongoing'

  return (
    <View style={[styles.row, { borderColor: colors.rule, backgroundColor: colors.surface }]}>
      <View style={styles.rowHead}>
        <Text style={[text.bodyMedium, styles.flex, { color: colors.ink }]}>
          {tag ?? `Hog ${cycle.hog_id}`}
        </Text>
        <Pill
          label={cycle.status === 'completed' ? 'Farrowed' : humanize(cycle.status)}
          tone={BREEDING_STATUS_TONE[cycle.status] ?? 'neutral'}
        />
      </View>

      <Text style={[text.meta, { color: colors.muted }]}>
        Served {formatBusinessDate(cycle.start_date, { dateStyle: 'medium' })}
        {/* Derived, exactly as the dashboard does it — the API stores no due
            date, and a stockperson plans around this number. */}
        {ongoing
          ? ` · due ${formatBusinessDate(addDays(cycle.start_date, GESTATION_DAYS), { dateStyle: 'medium' })}`
          : cycle.end_date
            ? ` · ended ${formatBusinessDate(cycle.end_date, { dateStyle: 'medium' })}`
            : ''}
      </Text>

      {cycle.notes ? <Text style={[text.meta, { color: colors.muted }]}>{cycle.notes}</Text> : null}

      {ongoing ? (
        <Locked when={!canManage} role="manager" can="you can view this cycle but not close it">
          <Button label="Close cycle" size="sm" variant="outline" onPress={onClose} />
        </Locked>
      ) : (
        <Text style={[text.meta, { color: colors.muted }]}>
          Closed — only notes can change now, from the web dashboard.
        </Text>
      )}
    </View>
  )
}

/**
 * Closing a cycle.
 *
 * The API requires `status` **and** `end_date` together — a `completed` with no
 * end date is a 400 — so this sheet cannot let one be submitted without the
 * other. `end_date` must also be on or after `start_date`, which is checked
 * here rather than discovered.
 */
function CloseCycle({
  cycle,
  tag,
  onDone,
}: {
  cycle: BreedingCycle
  tag: string | undefined
  onDone: () => void
}) {
  const colors = useColors()
  const today = useFarmToday()
  const [status, setStatus] = useState<'completed' | 'aborted' | undefined>('completed')
  const [endDate, setEndDate] = useState(today)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const mutation = useFarmMutation((body: Record<string, unknown>) =>
    api.mutate('PATCH', `/breeding-cycles/${cycle.id}`, body),
  )

  const beforeStart = endDate < cycle.start_date

  async function submit() {
    if (!status || beforeStart) return
    setBusy(true)
    setError(null)
    try {
      await mutation.mutateAsync({ status, end_date: endDate })
      onDone()
    } catch (cause) {
      setError(errorMessage(cause))
    } finally {
      setBusy(false)
    }
  }

  return (
    <View style={[styles.sheet, { backgroundColor: colors.ground, borderTopColor: colors.rule }]}>
      <Card>
        <CardHeader
          title={`Close ${tag ?? 'cycle'}`}
          hint={`Served ${formatBusinessDate(cycle.start_date, { dateStyle: 'medium' })}`}
        />
        <CardBody>
          <View style={styles.sheetBody}>
            {error ? <Banner tone="alert" message={error} /> : null}

            <View style={styles.stackSm}>
              <Text style={[text.meta, { color: colors.muted }]}>Outcome</Text>
              <SegmentedChips options={CLOSE_OPTIONS} value={status} onChange={setStatus} />
            </View>

            <DateField
              label="Ended on"
              value={endDate}
              onChange={setEndDate}
              today={today}
              error={beforeStart ? 'Cannot be before the cycle started.' : undefined}
            />

            <Button
              label="Close cycle"
              size="lg"
              fullWidth
              loading={busy}
              disabled={!status || beforeStart}
              onPress={submit}
            />
            <Button label="Cancel" variant="ghost" onPress={onDone} />
          </View>
        </CardBody>
      </Card>
    </View>
  )
}

const styles = StyleSheet.create({
  header: { padding: space.lg, gap: space.md },
  stack: { paddingHorizontal: space.lg, gap: space.sm },
  stackSm: { gap: space.sm },
  list: { paddingHorizontal: space.lg, paddingBottom: space.xxl, gap: space.sm },
  row: { borderWidth: 1, borderRadius: radii.control, padding: space.lg, gap: space.sm },
  rowHead: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  flex: { flex: 1 },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopWidth: 1,
    padding: space.lg,
  },
  sheetBody: { gap: space.lg },
})
