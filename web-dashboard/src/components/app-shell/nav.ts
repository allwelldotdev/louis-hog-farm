import {
  HeartPulse,
  LayoutDashboard,
  PiggyBank,
  Skull,
  Syringe,
  Wheat,
  Baby,
  type LucideIcon,
} from 'lucide-react'

export type NavItem = {
  href: string
  label: string
  icon: LucideIcon
}

export type NavGroup = {
  /** Absent on the first group: the dashboard needs no heading above it. */
  heading?: string
  items: NavItem[]
}

/**
 * Only routes that exist. Alerts, exports and settings arrive later in P9
 * together with their pages — a sidebar advertising links that 404 is worse
 * than a short one.
 *
 * Grouped once the list passed about five entries: "Herd" is the animals and
 * what happens to them, "Records" is what gets written down about them daily.
 */
export const NAV_GROUPS: NavGroup[] = [
  {
    items: [{ href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard }],
  },
  {
    heading: 'Herd',
    items: [
      { href: '/hogs', label: 'Hogs', icon: PiggyBank },
      { href: '/breeding', label: 'Breeding', icon: Baby },
      { href: '/mortality', label: 'Mortality', icon: Skull },
    ],
  },
  {
    heading: 'Records',
    items: [
      { href: '/records/health', label: 'Health', icon: HeartPulse },
      { href: '/records/feed', label: 'Feed', icon: Wheat },
      { href: '/vaccinations', label: 'Vaccinations', icon: Syringe },
    ],
  },
]
