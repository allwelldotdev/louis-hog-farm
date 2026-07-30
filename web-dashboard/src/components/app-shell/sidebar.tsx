'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { NAV_ITEMS } from '@/components/app-shell/nav'
import { Wordmark } from '@/components/wordmark'
import { cn } from '@/lib/utils'

export function Sidebar() {
  const pathname = usePathname()

  return (
    <nav
      aria-label="Sections"
      className="flex shrink-0 gap-1 border-b border-rule bg-surface px-4 py-3 lg:w-56 lg:flex-col lg:gap-6 lg:border-r lg:border-b-0 lg:px-5 lg:py-6"
    >
      <div className="hidden lg:block">
        <Wordmark />
      </div>

      <ul className="flex gap-1 lg:flex-col">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`)
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex items-center gap-2.5 rounded-control px-3 py-2 text-sm transition-colors',
                  active ? 'bg-raised text-ink' : 'text-muted hover:bg-raised hover:text-ink',
                )}
              >
                {/* The same 2px ochre mark as the wordmark rule — one motif
                    saying "you are here" in both places. */}
                <span
                  aria-hidden
                  className={cn('h-4 w-0.5 rounded-full', active ? 'bg-ochre' : 'bg-transparent')}
                />
                <item.icon aria-hidden className="size-4" />
                {item.label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
