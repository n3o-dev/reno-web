import { NextResponse } from 'next/server'
import { getDatabase } from '@/services/database'
import { signIn, SESSION_COOKIE } from '@/services/sessions'
import { signInSchema } from '@/app/login/_schemas/sign-in'

const REFUSED = 'Email or password is wrong'

/*
 * Fails closed. Deriving Secure from x-forwarded-proto alone means that
 * behind a TLS-terminating proxy which does not set the header — nginx only
 * does when told to — every session cookie on an HTTPS deployment is issued
 * without Secure, silently. Worse, a proxy that forwards a client-supplied
 * header lets an attacker send `x-forwarded-proto: http` and strip the flag.
 * In production it is on regardless of any header; the header only lets a
 * non-production deployment behind TLS have it too.
 */
function wantsSecureCookie(request: Request): boolean {
  if (process.env.NODE_ENV === 'production') return true
  if (request.headers.get('x-forwarded-proto') === 'https') return true
  return new URL(request.url).protocol === 'https:'
}

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
    // From the protocol, not from NODE_ENV: a cookie should be Secure when
    // it travelled over TLS. Behind a reverse proxy that is x-forwarded-proto,
    // which is why the VPS must terminate TLS and set it.
    secure: wantsSecureCookie(request),
    path: '/',
    maxAge: 60 * 60 * 24 * 14,
  })
  return response
}
