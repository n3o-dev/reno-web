import type { Metadata } from 'next'
import { SignInForm } from './_components/SignInForm'

export const metadata: Metadata = { title: 'Sign in · Reno' }

interface LoginPageProps {
  readonly searchParams: Promise<{ readonly next?: string }>
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { next } = await searchParams
  // Only a path on this site: an open redirect turns the sign-in page into a
  // way to send someone somewhere else with Reno's name on it.
  const safeNext = next !== undefined && next.startsWith('/') && !next.startsWith('//') ? next : '/'

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-4 py-10">
      <h1 className="font-[family-name:var(--font-display)] text-[28px] leading-[1.2]">Reno</h1>
      <p className="mb-6 text-[14px] text-muted">Living World Alam Sutera</p>
      <SignInForm next={safeNext} />
    </main>
  )
}
