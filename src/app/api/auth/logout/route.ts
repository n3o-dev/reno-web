import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getDatabase } from '@/services/database'
import { signOut, SESSION_COOKIE } from '@/services/sessions'

export async function POST(): Promise<NextResponse> {
  const jar = await cookies()
  const sessionId = jar.get(SESSION_COOKIE)?.value

  const db = getDatabase()
  // Delete the row as well as the cookie: clearing the cookie alone leaves a
  // session anyone holding the id could still use.
  if (db !== null && sessionId !== undefined) await signOut(db.sql, sessionId)

  const response = NextResponse.json({ signedOut: true })
  response.cookies.set(SESSION_COOKIE, '', { path: '/', maxAge: 0 })
  return response
}
