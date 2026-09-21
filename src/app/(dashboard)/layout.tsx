import { AppNav } from '@/components/common/AppNav'
import { SignOutButton } from '@/components/common/SignOutButton'
import { requireAccount } from '@/services/current-account'

/*
 * Never prerendered. These pages depend on who is asking, and a build has no
 * cookie: prerendering baked the signed-out redirect into a static page, so
 * every request bounced to /login however good its session was.
 */
export const dynamic = 'force-dynamic'

interface DashboardLayoutProps {
  readonly children: React.ReactNode
}

export default async function DashboardLayout({ children }: DashboardLayoutProps) {
  // Middleware saw a cookie; this confirms the session behind it is live.
  const account = await requireAccount('/')

  return (
    <div className="min-h-dvh">
      <header className="bg-ink text-surface">
        <div className="mx-auto flex max-w-6xl items-baseline gap-3 px-4 py-3">
          <span className="font-[family-name:var(--font-display)] text-[17px]">Reno</span>
          <span className="text-[13px] tracking-[0.04em] text-[#cfc7bd]">
            Living World Alam Sutera
          </span>
          <span className="ml-auto flex items-center gap-3 text-[13px] text-[#cfc7bd]">
            <span data-signed-in-as>{account.display_name}</span>
            <SignOutButton />
          </span>
        </div>
      </header>
      <div className="mx-auto max-w-6xl border-b border-line">
        <AppNav />
      </div>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  )
}
