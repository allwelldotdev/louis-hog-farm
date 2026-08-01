import { useState } from 'react'
import { StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native'
import Svg, { Circle, Line, Path } from 'react-native-svg'

import { EmptyState } from '@/components/ui/feedback'
import { buildSparkline, type SparklinePoint } from '@/lib/sparkline'
import { formatNumber } from '@/lib/format'
import { useColors } from '@/theme/theme-provider'
import { space } from '@/theme/tokens'
import { eyebrow, figure, figureSize } from '@/theme/type'

const HEIGHT = 96

/**
 * The whole analytics story on a hog, and the only chart in the app.
 *
 * Deliberately not a chart library: one `<Path>`, one `<Circle>` and a
 * baseline is the entire drawing, and the dashboard is where anyone goes to
 * actually analyse a herd. No axes, no gridlines, no tooltip, no animation —
 * the shape and the three figures beneath it are the message.
 *
 * The stroke reads `colors.chart1`, which the palette guarantees equals the
 * accent, so it retints with the theme like everything else.
 */
export function HogSparkline({ points }: { points: SparklinePoint[] }) {
  const colors = useColors()
  const [width, setWidth] = useState(0)

  if (points.length === 0) {
    return <EmptyState message="This animal has never been weighed." />
  }

  const chart = width > 0 ? buildSparkline(points, width, HEIGHT) : null
  const summary = buildSparkline(points, 100, HEIGHT)!
  const change = summary.latest - summary.first

  const onLayout = (event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width)

  return (
    <View style={styles.wrap}>
      <View style={{ height: HEIGHT }} onLayout={onLayout}>
        {chart ? (
          <Svg width={width} height={HEIGHT}>
            {/* A hairline at the lowest recorded weight, so the line has
                something to be above. */}
            <Line
              x1={0}
              y1={HEIGHT - 4}
              x2={width}
              y2={HEIGHT - 4}
              stroke={colors.rule}
              strokeWidth={1}
            />
            {chart.d ? (
              <Path
                d={chart.d}
                stroke={colors.chart1}
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
                fill="none"
              />
            ) : null}
            <Circle cx={chart.last.x} cy={chart.last.y} r={3.5} fill={colors.chart1} />
          </Svg>
        ) : null}
      </View>

      <View style={styles.figures}>
        <Figure label="Latest" value={`${formatNumber(summary.latest, 1)} kg`} />
        <Figure
          label="Change"
          value={`${change >= 0 ? '+' : ''}${formatNumber(change, 1)} kg`}
          tone={change >= 0 ? colors.gain : colors.alert}
        />
        <Figure label="Weigh-ins" value={String(summary.count)} />
      </View>
    </View>
  )
}

function Figure({ label, value, tone }: { label: string; value: string; tone?: string }) {
  const colors = useColors()
  return (
    <View style={styles.figure}>
      <Text style={[eyebrow, { color: colors.muted }]}>{label}</Text>
      <Text style={[figure(figureSize.sm), { color: tone ?? colors.ink }]}>{value}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { gap: space.lg },
  figures: { flexDirection: 'row', gap: space.lg },
  figure: { flex: 1, gap: 2 },
})
