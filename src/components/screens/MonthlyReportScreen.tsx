import type { ScreenProps } from '@/components/screens/props'
import { ScreenHeader } from '@/components/common/ScreenHeader'
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

  return (
    <>
      <ScreenHeader title="Monthly Report" question="The pack, assembled" />
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
                  data-figure={`report.gate.${gate.label.toLowerCase().replaceAll(' ', '_')}`}
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
