'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Field, Input } from '@/components/ui/field'

/**
 * Registering creates a farm and its first manager in one step — the backend's
 * `/auth/register` takes a farm name alongside the account details, because a
 * user with no farm has nothing to look at.
 */
export function RegisterForm() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setPending(true)

    const form = new FormData(event.currentTarget)
    const email = String(form.get('email') ?? '')
    const password = String(form.get('password') ?? '')

    const created = await fetch('/api/backend/auth/register', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        email,
        password,
        full_name: String(form.get('full_name') ?? ''),
        farm_name: String(form.get('farm_name') ?? ''),
      }),
    })

    if (!created.ok) {
      const body = await created.json().catch(() => null)
      setError(body?.detail ?? body?.error ?? 'Could not create the account.')
      setPending(false)
      return
    }

    // Sign in straight away rather than bouncing to the sign-in page with the
    // credentials the person just typed.
    const signedIn = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })

    if (!signedIn.ok) {
      router.replace('/')
      return
    }

    router.replace('/dashboard')
    router.refresh()
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      <Field label="Farm name" htmlFor="farm_name">
        <Input id="farm_name" name="farm_name" required placeholder="Bright Acres Farm" />
      </Field>

      <Field label="Your name" htmlFor="full_name">
        <Input id="full_name" name="full_name" required autoComplete="name" />
      </Field>

      <Field label="Email" htmlFor="email">
        <Input id="email" name="email" type="email" required autoComplete="username" />
      </Field>

      <Field
        label="Password"
        htmlFor="password"
        hint="At least 8 characters, with a letter and a number."
      >
        <Input
          id="password"
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
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
        {pending ? 'Creating…' : 'Create account'}
      </Button>
    </form>
  )
}
