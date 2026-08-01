import Link from 'next/link'

import { ThemeToggle } from '@/components/app-shell/theme-toggle'
import { SignInForm } from '@/components/auth/sign-in-form'
import { GrowthBand } from '@/components/growth-band'
import { Wordmark } from '@/components/wordmark'

/**
 * "/" is the sign-in page. There is no marketing landing page in front of it:
 * this system has one audience, the people who run the farm, and they came here
 * to look at their herd.
 */
export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>
}) {
  const { next } = await searchParams
  // Same-site paths only, so `?next=https://elsewhere` cannot turn the sign-in
  // page into an open redirect.
  const redirectTo = next?.startsWith('/') && !next.startsWith('//') ? next : '/dashboard'

  return (
    <main className="grid min-h-dvh lg:grid-cols-[1.15fr_1fr]">
      <section className="relative hidden flex-col justify-between border-r border-rule bg-surface p-10 lg:flex">
        <Wordmark />

        <div className="flex flex-1 flex-col justify-center py-10">
          <div className="max-w-xl space-y-4">
            <p className="eyebrow">Herd weight — 26 weeks</p>
            <GrowthBand className="w-full" />
            <p className="text-sm leading-relaxed text-muted">
              Median weight, with the tenth and ninetieth percentile either side. When the band
              widens faster than the middle climbs, animals are falling behind — and an average on
              its own would not show it.
            </p>
          </div>
        </div>

        <p className="text-xs text-muted">
          Illustrative shape. Your herd&rsquo;s figures load after sign-in.
        </p>
      </section>

      <section className="flex flex-col justify-center px-6 py-12 sm:px-12">
        <div className="mx-auto w-full max-w-sm space-y-8">
          {/* The toggle is here as well as in the app shell so a light-preferring
              visitor is not met by a dark sign-in before any preference exists.
              It works outside the `(app)` providers because the theme store is
              an attribute on <html>, not a React context. */}
          <div className="flex items-start justify-between gap-4">
            <div className="lg:hidden">
              <Wordmark />
            </div>
            <ThemeToggle />
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-semibold tracking-tight text-ink">Sign in</h1>
            <p className="text-sm text-muted">Herd growth, feed cost and health records.</p>
          </div>

          <SignInForm redirectTo={redirectTo} />

          <p className="border-t border-rule pt-6 text-sm text-muted">
            New farm?{' '}
            <Link href="/register" className="font-medium text-ochre hover:underline">
              Create an account
            </Link>
          </p>
        </div>
      </section>
    </main>
  )
}
