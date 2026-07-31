import { LayoutDashboard, PiggyBank, type LucideIcon } from 'lucide-react'

export type NavItem = {
  href: string
  label: string
  icon: LucideIcon
}

/**
 * Only routes that exist. Records, breeding, alerts, exports and settings
 * arrive later in P9 together with their pages — a sidebar advertising links
 * that 404 is worse than a short one.
 */
export const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/hogs', label: 'Hogs', icon: PiggyBank },
]
