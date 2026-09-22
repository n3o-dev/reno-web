import type { ScreenProps } from '@/components/screens/props'
import { ScreenHeader } from '@/components/common/ScreenHeader'
import { Card } from '@/components/styled/Card'
import { Figure } from '@/components/common/Figure'
import { countEvidence, resolveEvidence, type Evidence } from '@/services/evidence'
import { closureStats } from '@/rules/clock'
import { repeatAreas } from '@/rules/causes'
import { applySlotCorrections, coverage, provisionalContracts, slotDays } from '@/rules/manpower'
import { getSlotOverrides } from '@/services/overrides'
import { computeRapor, AUTO_FILLED, RAPOR_INDICATORS, type Indicator } from '@/rules/rapor'
import { computeRealisation } from '@/rules/realisation'
import { countBeforeAfter, findDuplicatePhotos, validationPassRate } from '@/rules/quality'
import { WORKBOOK_LABEL, WORKBOOK_MONTH, getWorkbook, planCells, workbookEvidence } from '@/services/rkb'
import { getRecords } from '@/services/records'
import { IndicatorTable } from '@/components/screens/parts/IndicatorTable'

export async function ScorecardScreen({ siteId }: ScreenProps) {
  const [records, book] = await Promise.all([getRecords(siteId), getWorkbook()])
  const realisation = computeRealisation(
    // A.1 is the Pimpro's realisation score; it must count matched work.
    book.sheets.flatMap((sheet) => planCells(sheet, WORKBOOK_MONTH, records.rkbMatches)),
  )
  const complaints = closureStats(records.complaints)
  // Both of these used to be literals typed into the call, which meant the
  // Pimpro's score did not move when the thing it scores did.
  /*
   * The same corrected slot-days the invoice is built from. Deriving these
   * from the raw line-ups had /manpower deducting for a slot a person
   * corrected away while /scorecard scored attendance discipline as
   * flawless — a contradiction between two screens reading the same month.
   */
  const days = applySlotCorrections(slotDays(records.lineups), await getSlotOverrides())
  const unfilledSlotDays = coverage(provisionalContracts(records.lineups), days).reduce(
    (short, row) => short + (row.contractedSlotDays - row.filled),
    0,
  )
  const reports = records.workReports

  const rapor = computeRapor({
    realisation,
    complaints: {
      raised: complaints.raised,
      closedUnder24h: complaints.closedWithPhoto,
      repeatAreas: repeatAreas(records.complaints).length,
      clientIssuedSp: false,
    },
    attendance: { unfilledSlotDays },
    reports: {
      total: reports.length,
      passed: Math.round(validationPassRate(reports) * reports.length),
      beforeAfter: countBeforeAfter(reports),
      duplicatePhotos: findDuplicatePhotos(records.photos).length,
    },
  })

  /*
   * Each auto-filled indicator points at what produced it: A.1 at the
   * workbook, A.3 at the complaints, C.3 at the line-ups, D.3 at the reports.
   * The weighted total stands on all of them, so it cites the lot.
   */
  const perIndicator: Readonly<Record<string, readonly Evidence[]>> = {
    'A.1': [
      workbookEvidence(
        'whole workbook',
        book.sheets.flatMap((sheet) => sheet.sections.flatMap((x) => x.rows.map((r) => r.rowNumber))),
      ),
    ],
    'A.3': resolveEvidence(records, records.complaints.map((c) => c.source_message_id)),
    'C.3': resolveEvidence(records, records.lineups.map((l) => l.source_message_id)),
    'D.3': resolveEvidence(records, reports.map((r) => r.source_message_id)),
  }
  const allEvidence = Object.values(perIndicator).flat().slice(0, 5)
  const totalSources =
    1 +
    countEvidence(records.complaints.map((c) => c.source_message_id)) +
    countEvidence(records.lineups.map((l) => l.source_message_id)) +
    countEvidence(reports.map((r) => r.source_message_id))

  const filled = RAPOR_INDICATORS.filter((i: Indicator) => rapor.scores[i] !== null).length

  return (
    <>
      <ScreenHeader title="Pimpro Scorecard" question="The SOP form, part auto-filled" />
      <div className="grid gap-4 md:grid-cols-3">
        <Card
          title="Weighted total"
          info="The SOP's weighted total across sections A to D. It reads provisional until every indicator has a score, because nine of the thirteen cannot be evidenced from a WhatsApp group and are left for a person to fill."
        >
          <p className="font-[family-name:var(--font-display)] text-[38px] leading-[1.15] tabular-nums">
            <Figure name="rapor.total" evidence={allEvidence} total={totalSources}>
              {rapor.total.toFixed(2)}
            </Figure>
          </p>
          <p className="text-[13px] text-muted">
            {rapor.provisional ? 'Provisional' : 'Complete'} · predikat{' '}
            <Figure name="rapor.predikat" evidence={allEvidence} total={totalSources}>
              {rapor.predikat}
            </Figure>
          </p>
        </Card>
        <Card
          title="Filled from data"
          info="A.1 realisation, A.3 complaint handling, C.3 attendance discipline and D.3 report quality. Everything else needs a person: training, grooming, equipment condition and the rest are not visible in a chat group."
        >
          <p className="font-[family-name:var(--font-display)] text-[38px] leading-[1.15] tabular-nums">
            <Figure name="rapor.auto_filled" evidence={allEvidence} total={totalSources}>
              {AUTO_FILLED.length}
            </Figure>
            <span className="text-faint"> / {RAPOR_INDICATORS.length}</span>
          </p>
          <p className="text-[13px] text-muted">
            <span className="tabular-nums">{filled}</span> scored so far
          </p>
        </Card>
        <Card
          title="Source"
          info="A.1 is scored on net realisation, so work blocked by something outside Reno's control does not cost the Pimpro his rapor."
        >
          <p className="text-[14px] text-muted">{WORKBOOK_LABEL}</p>
          <p className="text-[14px] text-muted">
            {complaints.raised} complaints · {reports.length} reports
          </p>
        </Card>
      </div>
      <section className="mt-4 rounded-[var(--radius-card)] border border-line bg-surface p-5">
        <h2 className="mb-2 font-[family-name:var(--font-display)] text-[17px]">Indicators</h2>
        <IndicatorTable rapor={rapor} evidence={perIndicator} />
      </section>
    </>
  )
}
