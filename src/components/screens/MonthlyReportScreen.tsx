import Link from 'next/link'
import type { ScreenProps } from '@/components/screens/props'
import { ScreenHeader } from '@/components/common/ScreenHeader'
import { Figure } from '@/components/common/Figure'
import { monthReport } from '@/services/report'
import { PackSection, type SectionState } from '@/components/screens/parts/PackSection'
import { ConfirmRoster } from '@/components/screens/parts/ConfirmRoster'

/** The month the pack is for. One site, one plan, one month at a time. */
const MONTH = '2026-09'

export async function MonthlyReportScreen({ siteId }: ScreenProps) {
  const report = await monthReport(MONTH, siteId)
  const { pack, gates } = report
  const isClient = siteId !== undefined

  const counts = [
    {
      name: 'report.complaints',
      label: 'Complaints in the pack',
      value: pack.complaints.stats.raised,
      evidence: pack.complaints.evidence,
    },
    {
      name: 'report.work_orders',
      label: 'Work orders in the pack',
      value: pack.workOrders.summary.total,
      evidence: pack.workOrders.evidence,
    },
    {
      name: 'report.before_after',
      label: 'Before-after pairs',
      value: pack.evidenceGallery.beforeAfter,
      evidence: pack.evidenceGallery.evidence,
    },
  ]

  const sections: readonly { title: string; source: string; state: SectionState }[] = [
    { title: 'RKB realisation', source: pack.rkb.workbook, state: 'ready' },
    {
      title: 'Complaint summary',
      source: `${pack.complaints.stats.raised} complaints, ${pack.complaints.repeats.length} repeat areas`,
      state: 'ready',
    },
    {
      title: 'Work orders delivered',
      source: `${pack.workOrders.summary.total} requests`,
      state: 'ready',
    },
    {
      title: 'Manpower and billing',
      source:
        pack.manpower.payable.state === 'computed'
          ? pack.manpower.payable.provisional
            ? 'Amount computed, headcount assumed'
            : 'Amount computed from the contract'
          : 'Waiting on the contract',
      state: pack.manpower.payable.state === 'computed' ? 'ready' : 'blocked',
    },
    {
      title: 'Before-after gallery',
      source: `${pack.evidenceGallery.beforeAfter} reports`,
      state: 'ready',
    },
    ...pack.humanSections.map((section) => ({
      title: section.title,
      source: section.awaiting,
      state: (section.title === 'Training completed' ? 'external' : 'human') as SectionState,
    })),
  ]

  return (
    <>
      <ScreenHeader title="Monthly Report" question="The pack, assembled" />
      <p className="-mt-4 mb-6 text-[13px] text-muted">{pack.period.label}</p>

      <div className="mb-4 grid gap-4 sm:grid-cols-3">
        {counts.map((count) => (
          <div
            key={count.name}
            className="rounded-[var(--radius-card)] border border-line bg-surface p-5"
          >
            <p className="text-[11.5px] tracking-[0.10em] text-faint uppercase">{count.label}</p>
            <Figure
              name={count.name}
              evidence={count.evidence.items}
              total={count.evidence.total}
              className="font-[family-name:var(--font-display)] text-[32px] leading-[1.05] tabular-nums"
            >
              {count.value}
            </Figure>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <section className="rounded-[var(--radius-card)] border border-line bg-surface p-5">
          <h2 className="mb-2 font-[family-name:var(--font-display)] text-[17px]">
            What the pack contains
          </h2>
          <ul>
            {sections.map((section) => (
              <PackSection key={section.title} {...section} />
            ))}
          </ul>
          <div className="mt-4 flex flex-wrap gap-3 border-t border-line pt-4 text-[14px]">
            {/* Print lives outside /c, so the client cannot reach it. */}
            {!isClient && (
            <Link
              href={`/print/${MONTH}`}
              className="min-h-11 rounded-[var(--radius-control)] border border-line px-4 py-2.5"
            >
              Open the client report
            </Link>
            )}
            {!isClient && (
              <a
                href={`/api/report/rkb?month=${MONTH}`}
                data-download="rkb"
                className={[
                  'min-h-11 rounded-[var(--radius-control)] px-4 py-2.5',
                  report.generatable
                    ? 'bg-ink text-surface'
                    : 'pointer-events-none border border-line text-faint',
                ].join(' ')}
                aria-disabled={!report.generatable}
              >
                Download the RKB workbook
              </a>
            )}
          </div>
        </section>

        <section className="rounded-[var(--radius-card)] border border-line bg-surface p-5">
          <h2 className="font-[family-name:var(--font-display)] text-[17px]">
            Before it generates
          </h2>
          <p className="mt-1 mb-3 text-[13px] text-muted">
            Each gate has to pass. Generation refuses rather than producing a pack that is
            quietly wrong.
          </p>
          <ul>
            {gates.map((gate) => (
              <li
                key={gate.id}
                className="flex items-baseline justify-between gap-4 border-b border-line py-3 text-[14px] last:border-0"
              >
                <span>
                  {gate.label}
                  <span className="block text-[13px] text-muted">
                    {gate.passed
                      ? gate.id === 'roster_confirmed' && report.confirmation !== null
                        ? `Confirmed by ${report.confirmation.confirmedBy}`
                        : 'Nothing outstanding'
                      : gate.detail}
                  </span>
                </span>
                <span
                  data-status={`report.gate.${gate.id}`}
                  className="shrink-0 whitespace-nowrap"
                  style={{ color: gate.passed ? 'var(--color-good)' : 'var(--color-warning)' }}
                >
                  {gate.passed ? 'Passed' : 'Waiting'}
                </span>
              </li>
            ))}
          </ul>
          {!isClient && report.confirmation === null && <ConfirmRoster month={MONTH} />}
        </section>
      </div>
    </>
  )
}
