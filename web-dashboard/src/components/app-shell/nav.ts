import { LayoutDashboard, type LucideIcon } from 'lucide-react'

export type NavItem = {
  href: string
  label: string
  icon: LucideIcon
}

/**
 * Only routes that exist. Hogs, records, breeding, alerts, exports and settings
 * arrive in P9 together with their pages — a sidebar advertising links that
 * 404 is worse than a short one.
 */
export const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
]
