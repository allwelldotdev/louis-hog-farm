import Link from 'next/link'

import { Wordmark } from '@/components/wordmark'

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col justify-center px-6">
      <div className="mx-auto w-full max-w-sm space-y-6">
        <Wordmark />
        <div className="space-y-2">
          <p className="eyebrow">404</p>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">
            That page isn&rsquo;t here
          </h1>
          <p className="text-sm text-muted">
            The link may be out of date, or the record may have been archived.
          </p>
        </div>
        <Link href="/dashboard" className="text-sm font-medium text-ochre hover:underline">
          Go to the dashboard
        </Link>
      </div>
    </main>
  )
}
