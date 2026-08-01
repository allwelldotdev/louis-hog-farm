import { useState } from 'react'
import { FlatList, StyleSheet, Text, View } from 'react-native'

import { Banner, EmptyState, Skeleton } from '@/components/ui/feedback'
import { ALERT_STATUS_TONE, Pill } from '@/components/ui/pill'
import { Screen, ScreenHeader } from '@/components/ui/screen'
import { SegmentedChips } from '@/components/ui/segmented-chips'
import { useAlerts, useHogTags } from '@/hooks/use-hogs'
import { errorMessage } from '@/lib/api/errors'
import { ALERT_STATUSES, type Alert, type AlertStatus } from '@/lib/api/types'
import { formatBusinessDate, humanize } from '@/lib/format'
import { useColors } from '@/theme/theme-provider'
import { radii, space } from '@/theme/tokens'
import { text } from '@/theme/type'

/**
 * The alerts inbox.
 *
 * Read-only in this phase; acknowledge and resolve arrive in P6 behind the
 * manager lock, because `PATCH /alerts/{id}` is manager-gated. Reading is open
 * to every role, which is the asymmetry that makes present-but-locked work
 * here: a worker genuinely sees what needs attention and can say so to
 * someone, rather than not knowing the alert exists.
 */
export default function Alerts() {
  const [status, setStatus] = useState<AlertStatus | undefined>('open')
  const { data, isPending, error } = useAlerts({ status })
  const tags = useHogTags()

  return (
    <Screen scroll={false}>
      <View style={styles.header}>
        <ScreenHeader section="Attention" title="Alerts" />
        <SegmentedChips
          options={ALERT_STATUSES.map((value) => ({ value, label: humanize(value) }))}
          value={status}
          onChange={setStatus}
          allowClear
          clearLabel="All"
        />
      </View>

      {isPending ? (
        <View style={styles.stack}>
          <Skeleton height={80} />
          <Skeleton height={80} />
        </View>
      ) : error ? (
        <Banner tone="alert" message={errorMessage(error)} />
      ) : (
        <FlatList
          data={data?.items ?? []}
          keyExtractor={(alert) => String(alert.id)}
          renderItem={({ item }) => <AlertRow alert={item} tag={tags.get(item.hog_id)} />}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <EmptyState
              message={
                status === 'open' ? 'Nothing needs attention right now.' : 'No alerts to show.'
              }
            />
          }
        />
      )}
    </Screen>
  )
}

function AlertRow({ alert, tag }: { alert: Alert; tag: string | undefined }) {
  const colors = useColors()
  return (
    <View style={[styles.row, { borderColor: colors.rule, backgroundColor: colors.surface }]}>
      <View style={styles.rowHead}>
        <Text style={[text.bodyMedium, styles.flex, { color: colors.ink }]}>
          {humanize(alert.alert_type)}
        </Text>
        <Pill label={humanize(alert.status)} tone={ALERT_STATUS_TONE[alert.status] ?? 'neutral'} />
      </View>
      <Text style={[text.meta, { color: colors.ink }]}>{alert.message}</Text>
      <Text style={[text.meta, { color: colors.muted }]}>
        {/* The ear tag is what is written on the animal; "hog 47" is not. */}
        {tag ?? `Hog ${alert.hog_id}`} · {formatBusinessDate(alert.alert_date)}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  header: { padding: space.lg, gap: space.md },
  stack: { paddingHorizontal: space.lg, gap: space.sm },
  list: { paddingHorizontal: space.lg, paddingBottom: space.xxl, gap: space.sm },
  row: {
    borderWidth: 1,
    borderRadius: radii.control,
    padding: space.lg,
    gap: space.sm,
  },
  rowHead: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  flex: { flex: 1 },
})
