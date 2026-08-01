import { useRouter } from 'expo-router'
import { FlatList, StyleSheet, Text, View } from 'react-native'

import { Button } from '@/components/ui/button'
import { Banner, EmptyState, Skeleton } from '@/components/ui/feedback'
import { Locked } from '@/components/ui/locked'
import { Screen, ScreenHeader } from '@/components/ui/screen'
import { usePermissions } from '@/hooks/use-farm'
import { useHogTags } from '@/hooks/use-hogs'
import { useMortalityEvents } from '@/hooks/use-records'
import { errorMessage } from '@/lib/api/errors'
import type { MortalityEvent } from '@/lib/api/types'
import { formatBusinessDate } from '@/lib/format'
import { useColors } from '@/theme/theme-provider'
import { radii, space } from '@/theme/tokens'
import { text } from '@/theme/type'

/**
 * Mortality — the clearest case for present-but-locked.
 *
 * `GET /mortality-events` is open to every role, so a worker genuinely reads
 * this list; only `POST` is manager-gated. The screen is useful to everyone
 * and locks exactly one button, rather than being an empty shell.
 */
export default function Mortality() {
  const router = useRouter()
  const { canManage } = usePermissions()
  const { data, isPending, error } = useMortalityEvents()
  const tags = useHogTags()

  return (
    <Screen scroll={false}>
      <View style={styles.header}>
        <ScreenHeader section="Herd" title="Mortality" />
        <Locked when={!canManage} role="manager" can="you can view these records but not add them">
          <Button
            label="Record a death"
            variant="outline"
            fullWidth
            onPress={() => router.push('/manage/mortality-form')}
          />
        </Locked>
      </View>

      {isPending ? (
        <View style={styles.stack}>
          <Skeleton height={72} />
          <Skeleton height={72} />
        </View>
      ) : error ? (
        <View style={styles.stack}>
          <Banner tone="alert" message={errorMessage(error)} />
        </View>
      ) : (
        <FlatList
          data={data?.items ?? []}
          keyExtractor={(event) => String(event.id)}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => <Row event={item} tag={tags.get(item.hog_id)} />}
          ListEmptyComponent={<EmptyState message="No deaths recorded." />}
        />
      )}
    </Screen>
  )
}

function Row({ event, tag }: { event: MortalityEvent; tag: string | undefined }) {
  const colors = useColors()
  return (
    <View style={[styles.row, { borderColor: colors.rule, backgroundColor: colors.surface }]}>
      <View style={styles.rowHead}>
        <Text style={[text.bodyMedium, styles.flex, { color: colors.ink }]}>
          {tag ?? `Hog ${event.hog_id}`}
        </Text>
        <Text style={[text.meta, { color: colors.muted }]}>
          {formatBusinessDate(event.event_date, { dateStyle: 'medium' })}
        </Text>
      </View>
      <Text style={[text.meta, { color: colors.ink }]}>{event.cause}</Text>
      {event.notes ? <Text style={[text.meta, { color: colors.muted }]}>{event.notes}</Text> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  header: { padding: space.lg, gap: space.md },
  stack: { paddingHorizontal: space.lg, gap: space.sm },
  list: { paddingHorizontal: space.lg, paddingBottom: space.xxl, gap: space.sm },
  row: { borderWidth: 1, borderRadius: radii.control, padding: space.lg, gap: space.sm },
  rowHead: { flexDirection: 'row', alignItems: 'baseline', gap: space.md },
  flex: { flex: 1 },
})
