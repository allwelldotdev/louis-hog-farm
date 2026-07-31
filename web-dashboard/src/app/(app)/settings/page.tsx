import { ClientOnly } from '@/components/client-only'
import { SettingsView } from '@/components/settings/settings-view'

function Skeleton() {
  return <div className="h-96 animate-pulse rounded-card bg-surface" />
}

export default function SettingsPage() {
  return (
    <ClientOnly fallback={<Skeleton />}>
      <SettingsView />
    </ClientOnly>
  )
}
