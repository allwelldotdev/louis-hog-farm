import { EmptyState } from '@/components/ui/feedback'
import { Screen, ScreenHeader } from '@/components/ui/screen'

// Placeholder route so the shell has no dead links. Built in P4.
export default function Placeholder() {
  return (
    <Screen>
      <ScreenHeader section="Coming next" title="Hog detail" />
      <EmptyState message="This screen is built in P4." />
    </Screen>
  )
}
