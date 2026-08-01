import { Tabs } from 'expo-router'
import { Bell, LayoutGrid, Menu, PiggyBank, type LucideIcon } from 'lucide-react-native'
import { StyleSheet, View, type ColorValue } from 'react-native'

import { useDataVersionPoller } from '@/hooks/use-farm'
import { useColors } from '@/theme/theme-provider'
import { FONT_MEDIUM } from '@/theme/type'

/**
 * Four tabs: Today, Hogs, Alerts, More.
 *
 * **Icon and label, always.** Icon-only tabs are a memory test, and the brief
 * is explicit about non-technical users and low fatigue.
 *
 * **There is deliberately no Capture tab.** Every capture flow needs a hog
 * first, so a Capture tab would open on a question ("which animal?") rather
 * than an action. Capture instead lives as a grid of large tiles at the top of
 * Today, which is on screen at cold open and is the biggest target the app can
 * offer.
 */
export default function TabsLayout() {
  const colors = useColors()

  // Mounted once, here, so a single poller covers every tab — and only inside
  // the signed-in group, so it never fires on the sign-in screen.
  useDataVersionPoller()

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.ink,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.rule,
          height: 64,
          paddingTop: 6,
          paddingBottom: 8,
        },
        tabBarLabelStyle: { fontFamily: FONT_MEDIUM, fontSize: 12 },
        tabBarItemStyle: { paddingVertical: 2 },
      }}
    >
      <Tabs.Screen
        name="today"
        options={{
          title: 'Today',
          tabBarIcon: (props) => <TabIcon {...props} glyph={LayoutGrid} />,
        }}
      />
      <Tabs.Screen
        name="hogs"
        options={{ title: 'Hogs', tabBarIcon: (props) => <TabIcon {...props} glyph={PiggyBank} /> }}
      />
      <Tabs.Screen
        name="alerts"
        options={{ title: 'Alerts', tabBarIcon: (props) => <TabIcon {...props} glyph={Bell} /> }}
      />
      <Tabs.Screen
        name="more"
        options={{ title: 'More', tabBarIcon: (props) => <TabIcon {...props} glyph={Menu} /> }}
      />
    </Tabs>
  )
}

/**
 * The dashboard's active-nav motif — a short ochre bar — moved above the icon.
 *
 * On the web it is a `h-4 w-0.5` mark beside the sidebar item; here it is the
 * same idea rotated, which is what makes the two surfaces feel like one
 * product rather than two apps against one API.
 */
function TabIcon({
  glyph: Glyph,
  color,
  focused,
}: {
  glyph: LucideIcon
  // React Navigation types this as RN's `ColorValue`, which admits the opaque
  // platform-colour object as well as a string. Only strings reach here.
  color: ColorValue
  focused: boolean
}) {
  const colors = useColors()
  return (
    <View style={styles.icon}>
      <View style={[styles.mark, { backgroundColor: focused ? colors.ochre : 'transparent' }]} />
      <Glyph size={22} color={color} />
    </View>
  )
}

const styles = StyleSheet.create({
  icon: { alignItems: 'center', gap: 4 },
  mark: { height: 2, width: 20, borderRadius: 999 },
})
