import { HeartPulse, LayoutDashboard, PiggyBank, Wheat, type LucideIcon } from 'lucide-react'

export type NavItem = {
  href: string
  label: string
  icon: LucideIcon
}

/**
 * Only routes that exist. Breeding, alerts, exports and settings arrive later
 * in P9 together with their pages — a sidebar advertising links that 404 is
 * worse than a short one.
 */
export const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/hogs', label: 'Hogs', icon: PiggyBank },
  { href: '/records/health', label: 'Health', icon: HeartPulse },
  { href: '/records/feed', label: 'Feed', icon: Wheat },
]
