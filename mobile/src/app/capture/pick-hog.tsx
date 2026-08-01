import { useLocalSearchParams, useRouter } from 'expo-router'
import { useMemo, useState } from 'react'
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native'

import { Button } from '@/components/ui/button'
import { Banner, EmptyState, Skeleton } from '@/components/ui/feedback'
import { Input } from '@/components/ui/field'
import { Screen, ScreenHeader } from '@/components/ui/screen'
import { useRecentHogs } from '@/hooks/use-recent-hogs'
import { useHogs } from '@/hooks/use-hogs'
import { errorMessage } from '@/lib/api/errors'
import { BREEDING_CLASSES, type Hog } from '@/lib/api/types'
import { humanize } from '@/lib/format'
import { useColors } from '@/theme/theme-provider'
import { radii, space } from '@/theme/tokens'
import { eyebrow, figure, figureSize, text } from '@/theme/type'

/** Where the picker hands the animal on to. */
const DESTINATIONS: Record<string, string> = {
  weigh: '/capture/health-record?mode=weigh',
  check: '/capture/health-record?mode=check',
  feed: '/capture/feed',
  vaccination: '/capture/vaccination',
  mortality: '/manage/mortality-form',
  breeding: '/manage/breeding-form',
}

/**
 * Choosing the animal — step one of every capture flow.
 *
 * The search box does **not** auto-focus. An unrequested keyboard covering the
 * Recent row is exactly the kind of small friction the brief calls UI fatigue,
 * and the common case is that the animal is already one tap away.
 */
export default function PickHog() {
  const colors = useColors()
  const router = useRouter()
  const params = useLocalSearchParams<{ next?: string; restrictTo?: string }>()

  const [search, setSearch] = useState('')
  const { data, isPending, error } = useHogs({ status: 'active' })
  const { recentIds } = useRecentHogs()

  // Breeding cycles apply to sows and gilts only; offering anything else
  // guarantees a 400 the picker could have prevented.
  const restrictTo = params.restrictTo === 'breeding' ? BREEDING_CLASSES : null

  const eligible = useMemo(() => {
    const items = data?.items ?? []
    return restrictTo ? items.filter((hog) => restrictTo.includes(hog.production_class)) : items
  }, [data, restrictTo])

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase()
    if (!needle) return eligible
    return eligible.filter(
      (hog) =>
        hog.tag_number.toLowerCase().includes(needle) || hog.breed.toLowerCase().includes(needle),
    )
  }, [eligible, search])

  const recent = useMemo(
    () =>
      recentIds
        .map((id) => eligible.find((hog) => hog.id === id))
        .filter((hog): hog is Hog => hog !== undefined),
    [recentIds, eligible],
  )

  function choose(hog: Hog) {
    const target = DESTINATIONS[params.next ?? 'weigh'] ?? DESTINATIONS.weigh
    const separator = target.includes('?') ? '&' : '?'
    // `replace`, not `push`: the picker should not sit in the back stack
    // between the tile and the form.
    router.replace(`${target}${separator}hogId=${hog.id}` as never)
  }

  return (
    <Screen scroll={false}>
      <View style={styles.header}>
        <ScreenHeader
          section="Capture"
          title="Which animal?"
          right={<Button label="Cancel" variant="ghost" size="sm" onPress={() => router.back()} />}
        />

        <Input
          value={search}
          onChangeText={setSearch}
          placeholder="Search ear tag"
          autoCapitalize="characters"
          autoCorrect={false}
          returnKeyType="search"
        />

        {recent.length > 0 && !search ? (
          <View style={styles.recent}>
            <Text style={[eyebrow, { color: colors.muted }]}>Recent</Text>
            <View style={styles.chips}>
              {recent.map((hog) => (
                <Pressable
                  key={hog.id}
                  accessibilityRole="button"
                  onPress={() => choose(hog)}
                  android_ripple={{ color: colors.ruleStrong }}
                  style={[
                    styles.chip,
                    { backgroundColor: colors.raised, borderColor: colors.rule },
                  ]}
                >
                  <Text style={[figure(figureSize.sm), { color: colors.ink }]}>
                    {hog.tag_number}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}
      </View>

      {isPending ? (
        <View style={styles.stack}>
          <Skeleton height={64} />
          <Skeleton height={64} />
        </View>
      ) : error ? (
        <Banner tone="alert" message={errorMessage(error)} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(hog) => String(hog.id)}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <Pressable
              accessibilityRole="button"
              onPress={() => choose(item)}
              android_ripple={{ color: colors.ruleStrong }}
              style={[styles.row, { borderColor: colors.rule, backgroundColor: colors.surface }]}
            >
              <Text style={[figure(figureSize.sm), { color: colors.ink }]}>{item.tag_number}</Text>
              <Text style={[text.meta, { color: colors.muted }]} numberOfLines={1}>
                {item.breed} · {humanize(item.production_class)}
              </Text>
            </Pressable>
          )}
          ListEmptyComponent={
            <EmptyState
              message={
                restrictTo
                  ? 'No sows or gilts on this farm.'
                  : search
                    ? `No active hog matches “${search}”.`
                    : 'No active hogs.'
              }
            />
          }
        />
      )}
    </Screen>
  )
}

const styles = StyleSheet.create({
  header: { padding: space.lg, gap: space.md },
  recent: { gap: space.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chip: {
    minHeight: 56,
    minWidth: 88,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: radii.control,
    paddingHorizontal: space.md,
    overflow: 'hidden',
  },
  stack: { paddingHorizontal: space.lg, gap: space.sm },
  list: { paddingHorizontal: space.lg, paddingBottom: space.xxl, gap: space.sm },
  row: {
    minHeight: 64,
    justifyContent: 'center',
    gap: 2,
    borderWidth: 1,
    borderRadius: radii.control,
    paddingHorizontal: space.lg,
    overflow: 'hidden',
  },
})
