import { useRouter } from 'expo-router'
import { useMemo, useState } from 'react'
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native'

import { Banner, EmptyState, Skeleton } from '@/components/ui/feedback'
import { Input } from '@/components/ui/field'
import { HOG_STATUS_TONE, Pill } from '@/components/ui/pill'
import { Screen, ScreenHeader } from '@/components/ui/screen'
import { SegmentedChips } from '@/components/ui/segmented-chips'
import { HOGS_PAGE_LIMIT, useHogs } from '@/hooks/use-hogs'
import { errorMessage } from '@/lib/api/errors'
import { HOG_STATUSES, type Hog, type HogStatus } from '@/lib/api/types'
import { humanize } from '@/lib/format'
import { useColors } from '@/theme/theme-provider'
import { radii, space } from '@/theme/tokens'
import { figure, figureSize, text } from '@/theme/type'

export default function Hogs() {
  const colors = useColors()
  const [status, setStatus] = useState<HogStatus | undefined>('active')
  const [search, setSearch] = useState('')

  const { data, isPending, error } = useHogs({ status })

  // `data?.items ?? []` outside the callback would be a fresh array identity on
  // every render, so the memo would never hold — which on a 200-row list is
  // exactly the case it exists for.
  const filtered = useMemo(() => {
    const items = data?.items ?? []
    const needle = search.trim().toLowerCase()
    if (!needle) return items
    return items.filter(
      (hog) =>
        hog.tag_number.toLowerCase().includes(needle) || hog.breed.toLowerCase().includes(needle),
    )
  }, [data, search])

  return (
    <Screen scroll={false}>
      <View style={styles.header}>
        <ScreenHeader section="Herd" title="Hogs" />
        <Input
          value={search}
          onChangeText={setSearch}
          placeholder="Search ear tag or breed"
          autoCapitalize="characters"
          autoCorrect={false}
          returnKeyType="search"
        />
        <SegmentedChips
          options={HOG_STATUSES.map((value) => ({ value, label: humanize(value) }))}
          value={status}
          onChange={setStatus}
          allowClear
          clearLabel="All"
        />
      </View>

      {isPending ? (
        <View style={styles.stack}>
          <Skeleton height={64} />
          <Skeleton height={64} />
          <Skeleton height={64} />
        </View>
      ) : error ? (
        <Banner tone="alert" message={errorMessage(error)} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(hog) => String(hog.id)}
          renderItem={({ item }) => <HogRow hog={item} />}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <EmptyState
              message={search ? `No hog matches “${search}”.` : 'No hogs match this filter.'}
            />
          }
          ListFooterComponent={
            // Truncating a herd silently is worse than admitting the ceiling.
            (data?.total ?? 0) > HOGS_PAGE_LIMIT ? (
              <Text style={[text.meta, styles.footer, { color: colors.muted }]}>
                Showing the first {HOGS_PAGE_LIMIT} of {data?.total}. Use the web dashboard for the
                full roster.
              </Text>
            ) : null
          }
        />
      )}
    </Screen>
  )
}

function HogRow({ hog }: { hog: Hog }) {
  const colors = useColors()
  const router = useRouter()

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push(`/hog/${hog.id}`)}
      android_ripple={{ color: colors.ruleStrong }}
      style={[styles.row, { borderColor: colors.rule, backgroundColor: colors.surface }]}
    >
      <View style={styles.rowText}>
        <Text style={[figure(figureSize.sm), { color: colors.ink }]}>{hog.tag_number}</Text>
        <Text style={[text.meta, { color: colors.muted }]} numberOfLines={1}>
          {hog.breed} · {humanize(hog.production_class)}
        </Text>
      </View>
      <Pill label={humanize(hog.status)} tone={HOG_STATUS_TONE[hog.status] ?? 'neutral'} />
    </Pressable>
  )
}

const styles = StyleSheet.create({
  header: { padding: space.lg, gap: space.md },
  stack: { paddingHorizontal: space.lg, gap: space.sm },
  list: { paddingHorizontal: space.lg, paddingBottom: space.xxl, gap: space.sm },
  row: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.md,
    borderWidth: 1,
    borderRadius: radii.control,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    overflow: 'hidden',
  },
  rowText: { flex: 1, gap: 2 },
  footer: { paddingTop: space.lg, textAlign: 'center' },
})
