import type { Metadata } from 'next'
import { SignInForm } from './_components/SignInForm'

export const metadata: Metadata = { title: 'Sign in · Reno' }

/**
 * A path on this site, or the home page.
 *
 * `startsWith('/') && !startsWith('//')` is not enough. The browser parses
 * the value by WHATWG rules, where a backslash is interchangeable with a
 * slash and leading control characters are stripped: `/\\evil.com` and
 * `/<tab>/evil.com` both resolve to another origin. An open redirect off a
 * real Reno URL is the ideal setup for a "your session expired" phish, so
 * this parses the value the way the browser will and keeps only the parts
 * that cannot leave the site.
 */
function safePath(next: string | undefined): string {
  if (next === undefined) return '/'
  const resolved = URL.parse(next, 'https://reno.invalid')
  if (resolved === null || resolved.origin !== 'https://reno.invalid') return '/'
  /*
   * Parsing is not enough on its own. `/.//evil.com` and `/a/..//evil.com`
   * normalise to a pathname of `//evil.com`, which keeps the dummy origin
   * here and then reads as protocol-relative in the browser — so the value
   * leaves the site after a successful sign-in on the genuine login page.
   * Collapsing the leading slashes is what actually closes it.
   */
  const path = `/${resolved.pathname.replace(/^\/+/, '')}`
  return `${path}${resolved.search}`
}

interface LoginPageProps {
  readonly searchParams: Promise<{ readonly next?: string }>
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { next } = await searchParams
  const safeNext = safePath(next)

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-4 py-10">
      <h1 className="font-[family-name:var(--font-display)] text-[28px] leading-[1.2]">Reno</h1>
      <p className="mb-6 text-[14px] text-muted">Living World Alam Sutera</p>
      <SignInForm next={safeNext} />
    </main>
  )
}
