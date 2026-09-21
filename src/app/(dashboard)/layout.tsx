import { AppNav } from '@/components/common/AppNav'

interface DashboardLayoutProps {
  readonly children: React.ReactNode
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <div className="min-h-dvh">
      <header className="bg-ink text-surface">
        <div className="mx-auto flex max-w-6xl items-baseline gap-3 px-4 py-3">
          <span className="font-[family-name:var(--font-display)] text-[17px]">Reno</span>
          <span className="text-[13px] tracking-[0.04em] text-[#cfc7bd]">
            Living World Alam Sutera
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
