import Link from 'next/link'

import { RegisterForm } from '@/components/auth/register-form'
import { Wordmark } from '@/components/wordmark'

export default function RegisterPage() {
  return (
    <main className="flex min-h-dvh flex-col justify-center px-6 py-12">
      <div className="mx-auto w-full max-w-sm space-y-8">
        <Wordmark />

        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Create a farm account</h1>
          <p className="text-sm text-muted">
            This sets up the farm and makes you its manager. You can add workers afterwards.
          </p>
        </div>

        <RegisterForm />

        <p className="border-t border-rule pt-6 text-sm text-muted">
          Already set up?{' '}
          <Link href="/" className="font-medium text-ochre hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  )
}
