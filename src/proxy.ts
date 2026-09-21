import { NextResponse, type NextRequest } from 'next/server'
import { SESSION_COOKIE } from '@/services/session-cookie'

/**
 * The first of two checks.
 *
 * Named `proxy` because Next 16 renamed the convention; it is the same
 * request-time check middleware was.
 *
 * This one is cheap and stateless: no cookie, no page. It cannot tell a live
 * session from a revoked one — that needs the database, which the dashboard
 * layout does — so it is a gate, not the gate. This gate alone would let a
 * deleted session keep working until it expired.
 *
 * See docs/specs/reno-auth.md (AC-1).
 */
const PUBLIC = ['/login', '/api/auth/login', '/api/records']

export function proxy(request: NextRequest): NextResponse {
  const { pathname, search } = request.nextUrl

  // The client link is a different door with a different key.
  if (pathname.startsWith('/c/')) return NextResponse.next()
  if (PUBLIC.some((path) => pathname === path || pathname.startsWith(`${path}/`))) {
    return NextResponse.next()
  }
  if (request.cookies.has(SESSION_COOKIE)) return NextResponse.next()

  const login = new URL('/login', request.url)
  login.searchParams.set('next', `${pathname}${search}`)
  return NextResponse.redirect(login)
}

export const config = {
  // Everything except Next's own assets and the favicon.
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
