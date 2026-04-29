// src/hooks/useAuth.ts  — local auth (no Supabase, data stays on this device)
import { useState, useEffect } from 'react'
import type { LocalUser } from '../types'

const USER_KEY = 'ideaboard_user'

interface UseAuthReturn {
  user: LocalUser | null
  session: null
  loading: boolean
  signIn: (email: string, password: string) => Promise<string | null>
  signUp: (email: string, password: string) => Promise<string | null>
  signOut: () => Promise<void>
}

export function useAuth(): UseAuthReturn {
  const [user, setUser] = useState<LocalUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    try {
      const stored = localStorage.getItem(USER_KEY)
      if (stored) setUser(JSON.parse(stored))
    } catch {}
    setLoading(false)
  }, [])

  const signIn = async (email: string, _password: string): Promise<string | null> => {
    if (!email.trim()) return 'Please enter a name or email'
    // Always use a fixed local ID so boards persist across sign-outs
    const u: LocalUser = { id: 'local-user', email: email.trim() }
    localStorage.setItem(USER_KEY, JSON.stringify(u))
    setUser(u)
    return null
  }

  const signUp = signIn  // same as sign in for local mode

  const signOut = async () => {
    localStorage.removeItem(USER_KEY)
    setUser(null)
  }

  return { user, session: null, loading, signIn, signUp, signOut }
}
