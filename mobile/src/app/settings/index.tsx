import { EmptyState } from '@/components/ui/feedback'
import { Screen, ScreenHeader } from '@/components/ui/screen'

// Placeholder route so the shell has no dead links. Built in P6.
export default function Placeholder() {
  return (
    <Screen>
      <ScreenHeader section="Coming next" title="Settings" />
      <EmptyState message="This screen is built in P6." />
    </Screen>
  )
}
