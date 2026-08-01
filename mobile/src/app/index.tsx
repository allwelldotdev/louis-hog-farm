import { StatusBar } from 'expo-status-bar'
import { StyleSheet, Text, View } from 'react-native'

// Placeholder. P3 replaces this with the boot route: a token in SecureStore
// sends you to the tabs, its absence to sign-in.
export default function Index() {
  return (
    <View style={styles.screen}>
      <View style={styles.rule} />
      <Text style={styles.title}>Bright Acres</Text>
      <Text style={styles.body}>Scaffold up. Design system lands next.</Text>
      <StatusBar style="light" />
    </View>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#0e1116',
  },
  rule: { height: 2, width: 32, borderRadius: 999, backgroundColor: '#c8873b' },
  title: { color: '#e8eaed', fontSize: 20, fontWeight: '600' },
  body: { color: '#8a96a6', fontSize: 13 },
})
