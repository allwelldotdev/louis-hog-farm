'use client'

import { useQueryClient } from '@tanstack/react-query'
import { LogOut } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { clearPersistedCache } from '@/lib/query/persist'

export function SignOutButton() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [pending, setPending] = useState(false)

  async function signOut() {
    setPending(true)
    await fetch('/api/auth/logout', { method: 'POST' })

    // Clear before navigating, not after. Whatever is left in the cache would
    // otherwise paint the previous farm's numbers for the next person to sign
    // in on this browser.
    //
    // Both halves are required: `clear()` empties the in-memory cache, and the
    // purge removes the copy on disk. Dropping only the first leaves the
    // previous farm's figures in localStorage, where the next session restores
    // them on mount — signed out, before any request is authorised.
    queryClient.clear()
    clearPersistedCache()

    router.replace('/')
    router.refresh()
  }

  return (
    <Button variant="ghost" size="sm" onClick={signOut} disabled={pending}>
      <LogOut aria-hidden />
      {pending ? 'Signing out…' : 'Sign out'}
    </Button>
  )
}
