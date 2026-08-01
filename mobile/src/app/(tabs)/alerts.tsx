import { useState } from 'react'
import { FlatList, StyleSheet, Text, View } from 'react-native'

import { api } from '@/api-runtime'
import { Button } from '@/components/ui/button'
import { Banner, EmptyState, Skeleton } from '@/components/ui/feedback'
import { Locked } from '@/components/ui/locked'
import { ALERT_STATUS_TONE, Pill } from '@/components/ui/pill'
import { Screen, ScreenHeader } from '@/components/ui/screen'
import { SegmentedChips } from '@/components/ui/segmented-chips'
import { usePermissions } from '@/hooks/use-farm'
import { useFarmMutation } from '@/hooks/use-farm-mutation'
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
 * Reading is open to every role; `PATCH /alerts/{id}` is manager-gated. That
 * asymmetry is what makes present-but-locked work here — a worker genuinely
 * sees what needs attention and can raise it with someone, rather than not
 * knowing the alert exists at all.
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
  const { canManage } = usePermissions()
  const [error, setError] = useState<string | null>(null)

  // There is no /acknowledge or /resolve sub-path — both are a PATCH of the
  // status field, and both are manager-gated.
  const mutation = useFarmMutation((status: AlertStatus) =>
    api.mutate('PATCH', `/alerts/${alert.id}`, { status }),
  )

  function set(status: AlertStatus) {
    setError(null)
    mutation.mutateAsync(status).catch((cause) => setError(errorMessage(cause)))
  }

  const open = alert.status === 'open'
  const resolved = alert.status === 'resolved'

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

      {error ? <Banner tone="alert" message={error} /> : null}

      {resolved ? null : (
        <Locked when={!canManage} role="manager" can="you can see alerts but not clear them">
          <View style={styles.actions}>
            {open ? (
              <Button
                label="Acknowledge"
                size="sm"
                variant="ghost"
                loading={mutation.isPending}
                onPress={() => set('acknowledged')}
              />
            ) : null}
            <Button
              label="Resolve"
              size="sm"
              variant="outline"
              loading={mutation.isPending}
              onPress={() => set('resolved')}
            />
          </View>
        </Locked>
      )}
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
  actions: { flexDirection: 'row', gap: space.sm },
  flex: { flex: 1 },
})
