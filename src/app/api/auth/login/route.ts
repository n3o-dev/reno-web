import { NextResponse } from 'next/server'
import { getDatabase } from '@/services/database'
import { signIn, SESSION_COOKIE } from '@/services/sessions'
import { signInSchema } from '@/app/login/_schemas/sign-in'

const REFUSED = 'Email or password is wrong'

export async function POST(request: Request): Promise<NextResponse> {
  const db = getDatabase()
  if (db === null) {
    return NextResponse.json({ error: 'no database configured' }, { status: 503 })
  }

  let json: unknown = null
  try {
    json = await request.json()
  } catch {
    return NextResponse.json({ error: REFUSED }, { status: 400 })
  }

  const parsed = signInSchema.safeParse(json)
  // Deliberately the same message as a wrong password: a different one for a
  // malformed body tells an attacker their guess reached the check.
  if (!parsed.success) return NextResponse.json({ error: REFUSED }, { status: 401 })

  const result = await signIn(db.sql, parsed.data.email, parsed.data.password)
  if (!result.ok) {
    return result.reason === 'throttled'
      ? NextResponse.json(
          { error: `Too many attempts. Try again in ${result.waitMinutes} minutes.` },
          { status: 429 },
        )
      : NextResponse.json({ error: REFUSED }, { status: 401 })
  }

  const response = NextResponse.json({ signedInAs: result.account.display_name })
  response.cookies.set(SESSION_COOKIE, result.sessionId, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 14,
  })
  return response
}
