import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { accountForSession, type Account } from './sessions'
import { SESSION_COOKIE } from './session-cookie'
import { getDatabase } from './database'

/**
 * The second of two checks, and the one that matters.
 *
 * Middleware saw a cookie; this confirms the session behind it is still live.
 * That is what makes revocation immediate rather than "within a fortnight".
 *
 * See docs/specs/reno-auth.md (AC-6).
 */
export async function currentAccount(): Promise<Account | null> {
  const db = getDatabase()
  if (db === null) return null
  const sessionId = (await cookies()).get(SESSION_COOKIE)?.value
  if (sessionId === undefined) return null
  return accountForSession(db.sql, sessionId)
}

/** The signed-in person, or a redirect to sign in and come back. */
export async function requireAccount(path: string): Promise<Account> {
  const account = await currentAccount()
  if (account === null) redirect(`/login?next=${encodeURIComponent(path)}`)
  return account
}
