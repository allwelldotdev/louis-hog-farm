'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { NAV_GROUPS, type NavItem } from '@/components/app-shell/nav'
import { Wordmark } from '@/components/wordmark'
import { cn } from '@/lib/utils'

/**
 * `/records/health` must not light up `/records/feed`, so the prefix rule only
 * applies below a section root: `/hogs/60` is still "Hogs", but two siblings
 * under `/records` are two different destinations.
 */
function isActive(pathname: string, item: NavItem): boolean {
  return pathname === item.href || pathname.startsWith(`${item.href}/`)
}

export function Sidebar() {
  const pathname = usePathname()

  return (
    <nav
      aria-label="Sections"
      className="flex shrink-0 gap-1 overflow-x-auto border-b border-rule bg-surface px-4 py-3 lg:w-56 lg:flex-col lg:gap-5 lg:overflow-visible lg:border-r lg:border-b-0 lg:px-5 lg:py-6"
    >
      <div className="hidden lg:block">
        <Wordmark />
      </div>

      {NAV_GROUPS.map((group, index) => (
        <div key={group.heading ?? index} className="lg:space-y-1.5">
          {group.heading ? <p className="eyebrow hidden px-3 lg:block">{group.heading}</p> : null}

          <ul className="flex gap-1 lg:flex-col">
            {group.items.map((item) => {
              const active = isActive(pathname, item)
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'flex items-center gap-2.5 rounded-control px-3 py-2 text-sm whitespace-nowrap transition-colors',
                      active ? 'bg-raised text-ink' : 'text-muted hover:bg-raised hover:text-ink',
                    )}
                  >
                    {/* The same 2px ochre mark as the wordmark rule — one motif
                        saying "you are here" in both places. */}
                    <span
                      aria-hidden
                      className={cn(
                        'h-4 w-0.5 rounded-full',
                        active ? 'bg-ochre' : 'bg-transparent',
                      )}
                    />
                    <item.icon aria-hidden className="size-4" />
                    {item.label}
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </nav>
  )
}
