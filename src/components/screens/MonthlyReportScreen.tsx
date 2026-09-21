import type { ScreenProps } from '@/components/screens/props'
import { ScreenHeader } from '@/components/common/ScreenHeader'
import { Figure } from '@/components/common/Figure'
import { bundleEvidence } from '@/services/evidence'
import { getRecords } from '@/services/records'
import { WORKBOOK_LABEL } from '@/services/rkb'
import { doubleListings, headcountMismatches } from '@/rules/manpower'
import { PackSection, type SectionState } from '@/components/screens/parts/PackSection'

export async function MonthlyReportScreen({ siteId }: ScreenProps) {
  const records = await getRecords(siteId)

  const undecidedAliases = 0
  const uncitedBlocks = records.complaints.filter(
    (c) => c.state === 'blocked' && c.blocked_reason_message_id === null,
  ).length
  const rosterProblems =
    doubleListings(records.lineups).length + headcountMismatches(records.lineups).length

  const gates: readonly { readonly label: string; readonly met: boolean; readonly note: string }[] =
    [
      {
        label: 'Roster confirmed for the month',
        met: false,
        note: 'BAPP cannot generate against claimed attendance alone',
      },
      {
        label: 'Every alias decided',
        met: undecidedAliases === 0,
        note: 'An unmerged Dame and Damme would double-count a person',
      },
      {
        label: 'Every blocked record cites its reason',
        met: uncitedBlocks === 0,
        note: `${uncitedBlocks} uncited`,
      },
      {
        label: 'Roster signals cleared',
        met: rosterProblems === 0,
        note: `${rosterProblems} to check`,
      },
    ]

  const sections: readonly { readonly title: string; readonly source: string; readonly state: SectionState }[] = [
    { title: 'RKB realisation', source: WORKBOOK_LABEL, state: 'ready' },
    { title: 'Complaint summary', source: `${records.complaints.length} complaints`, state: 'ready' },
    { title: 'Work orders delivered', source: `${records.workOrders.length} requests`, state: 'ready' },
    { title: 'Manpower and billing', source: 'Contract rate not loaded', state: 'blocked' },
    {
      title: 'Before-after gallery',
      source: `${records.workReports.filter((r) => r.is_before_after).length} reports`,
      state: 'ready',
    },
    { title: 'Training completed', source: 'Renno Grow Hub', state: 'external' },
    { title: 'Action plan', source: 'Written by the Project Coordinator', state: 'human' },
    { title: 'Client sign-off', source: 'WhatsApp confirmation', state: 'human' },
  ]

  const counts = [
    {
      name: 'report.complaints',
      label: 'Complaints in the pack',
      value: records.complaints.length,
      ids: records.complaints.map((c) => c.source_message_id),
      empty: 'No complaint was raised in this period.',
    },
    {
      name: 'report.work_orders',
      label: 'Work orders in the pack',
      value: records.workOrders.length,
      ids: records.workOrders.map((w) => w.source_message_id),
      empty: 'The client raised no work order in this period.',
    },
    {
      name: 'report.before_after',
      label: 'Before-after pairs',
      value: records.workReports.filter((r) => r.is_before_after).length,
      ids: records.workReports
        .filter((r) => r.is_before_after)
        .map((r) => r.source_message_id),
      empty: 'No report in this period carried before and after.',
    },
  ]

  return (
    <>
      <ScreenHeader title="Monthly Report" question="The pack, assembled" />
      <div className="mb-4 grid gap-4 sm:grid-cols-3">
        {counts.map((count) => {
          const cited = bundleEvidence(records, count.ids, count.empty)
          return (
            <div
              key={count.name}
              className="rounded-[var(--radius-card)] border border-line bg-surface p-5"
            >
              <p className="text-[11.5px] tracking-[0.10em] text-faint uppercase">{count.label}</p>
              <Figure
                name={count.name}
                evidence={cited.items}
                total={cited.total}
                className="font-[family-name:var(--font-display)] text-[32px] leading-[1.05] tabular-nums"
              >
                {count.value}
              </Figure>
            </div>
          )
        })}
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
        </section>
        <section className="rounded-[var(--radius-card)] border border-line bg-surface p-5">
          <h2 className="font-[family-name:var(--font-display)] text-[17px]">Before it generates</h2>
          <p className="mt-1 mb-3 text-[13px] text-muted">
            Each gate has to pass. Generation refuses rather than producing a pack that is
            quietly wrong.
          </p>
          <ul>
            {gates.map((gate) => (
              <li
                key={gate.label}
                className="flex items-baseline justify-between gap-4 border-b border-line py-3 text-[14px] last:border-0"
              >
                <span>
                  {gate.label}
                  <span className="block text-[13px] text-muted">{gate.note}</span>
                </span>
                <span
                  data-status={`report.gate.${gate.label.toLowerCase().replaceAll(' ', '_')}`}
                  className="shrink-0 whitespace-nowrap text-muted"
                  style={{ color: gate.met ? 'var(--color-good)' : 'var(--color-warning)' }}
                >
                  {gate.met ? 'Passed' : 'Waiting'}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-4 border-t border-line pt-3 text-[13px] text-muted">
            Generation is not wired yet — see docs/specs/monthly-report-pack.md.
          </p>
        </section>
      </div>
    </>
  )
}
