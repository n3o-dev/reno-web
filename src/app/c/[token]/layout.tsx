import { unauthorized } from 'next/navigation'
import { resolveToken } from '@/services/tokens'
import { ClientNav } from '@/components/common/ClientNav'

interface ClientLayoutProps {
  readonly children: React.ReactNode
  readonly params: Promise<{ readonly token: string }>
}

/**
 * The client surface. One link per site, opened on a phone inside WhatsApp.
 *
 * Read-only by construction: it renders the same screens from the same data
 * with no form control anywhere, and the internal screens have no route here
 * at all, so there is nothing to hide — /c/<token>/report-quality is a 404
 * because it does not exist (AC-3, AC-6).
 */
export default async function ClientLayout({ children, params }: ClientLayoutProps) {
  const { token } = await params
  const link = await resolveToken(token)
  if (link === null) unauthorized()

  return (
    <div className="min-h-dvh">
      <header className="bg-ink text-surface">
        <div className="mx-auto flex max-w-3xl items-baseline gap-3 px-4 py-3">
          <span className="font-[family-name:var(--font-display)] text-[17px]">Reno</span>
          <span className="text-[13px] tracking-[0.04em] text-[#cfc7bd]">{link.label}</span>
        </div>
      </header>
      <div className="mx-auto max-w-3xl border-b border-line">
        <ClientNav token={token} />
      </div>
      <main className="mx-auto max-w-3xl px-4 py-6">{children}</main>
      <footer className="mx-auto max-w-3xl px-4 pb-8 text-[13px] text-faint">
        Read-only. Figures come from the site WhatsApp group.
      </footer>
    </div>
  )
}
