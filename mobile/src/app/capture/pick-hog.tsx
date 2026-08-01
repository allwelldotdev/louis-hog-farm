import { EmptyState } from '@/components/ui/feedback'
import { Screen, ScreenHeader } from '@/components/ui/screen'

// Placeholder route so the shell has no dead links. Built in P5.
export default function Placeholder() {
  return (
    <Screen>
      <ScreenHeader section="Coming next" title="Pick a hog" />
      <EmptyState message="This screen is built in P5." />
    </Screen>
  )
}
