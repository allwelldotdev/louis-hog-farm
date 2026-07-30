'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Field, Input } from '@/components/ui/field'

export function SignInForm({ redirectTo }: { redirectTo: string }) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setPending(true)

    const form = new FormData(event.currentTarget)
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        email: String(form.get('email') ?? ''),
        password: String(form.get('password') ?? ''),
      }),
    })

    if (!response.ok) {
      const body = await response.json().catch(() => null)
      setError(body?.error ?? 'Could not sign in. Try again.')
      setPending(false)
      return
    }

    // The session lives in httpOnly cookies the client cannot see, so the route
    // gate has to re-run on the server for the redirect to stick.
    router.replace(redirectTo)
    router.refresh()
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      <Field label="Email" htmlFor="email">
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          required
          placeholder="manager@brightacres.com"
        />
      </Field>

      <Field label="Password" htmlFor="password">
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </Field>

      {error ? (
        <p
          className="rounded-control border border-alert/40 bg-alert/10 px-3 py-2 text-sm text-alert"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? 'Signing in…' : 'Sign in'}
      </Button>
    </form>
  )
}
