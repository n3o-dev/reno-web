'use client'

import { useState } from 'react'
import { apiClient } from '@/lib/axios'

export function SignOutButton() {
  const [leaving, setLeaving] = useState(false)

  const signOut = async (): Promise<void> => {
    setLeaving(true)
    try {
      await apiClient.post('/auth/logout')
      // Same reason as signing in: the whole tree has to re-render without
      // the cookie, and a soft navigation can serve it from the client cache.
      window.location.assign('/login')
    } finally {
      setLeaving(false)
    }
  }

  return (
    <button
      type="button"
      onClick={() => void signOut()}
      disabled={leaving}
      className="min-h-8 rounded-[var(--radius-control)] px-2 underline decoration-[#6f6558] hover:text-surface"
    >
      {leaving ? 'Signing out…' : 'Sign out'}
    </button>
  )
}
