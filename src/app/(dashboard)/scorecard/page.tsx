import { ScreenHeader } from '@/components/common/ScreenHeader'
import { Card } from '@/components/styled/Card'
import { closureStats } from '@/rules/clock'
import { computeRapor, AUTO_FILLED, RAPOR_INDICATORS, type Indicator } from '@/rules/rapor'
import { computeRealisation } from '@/rules/realisation'
import { countBeforeAfter, findDuplicatePhotos, validationPassRate } from '@/rules/quality'
import { WORKBOOK_LABEL, WORKBOOK_MONTH, getWorkbook, planCells } from '@/services/rkb'
import { getRecords } from '@/services/records'
import { IndicatorTable } from './_components/IndicatorTable'

export default async function ScorecardPage() {
  const [records, book] = await Promise.all([getRecords(), getWorkbook()])
  const realisation = computeRealisation(
    book.sheets.flatMap((sheet) => planCells(sheet, WORKBOOK_MONTH)),
  )
  const complaints = closureStats(records.complaints)
  const reports = records.workReports

  const rapor = computeRapor({
    realisation,
    complaints: {
      raised: complaints.raised,
      closedUnder24h: complaints.closedWithPhoto,
      // The seven areas the period saw complained about on more than one day.
      repeatAreas: 7,
      clientIssuedSp: false,
    },
    attendance: { unfilledSlotDays: 0 },
    reports: {
      total: reports.length,
      passed: Math.round(validationPassRate(reports) * reports.length),
      beforeAfter: countBeforeAfter(reports),
      duplicatePhotos: findDuplicatePhotos(records.photos).length,
    },
  })

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
            <span data-figure="rapor.total">{rapor.total.toFixed(2)}</span>
          </p>
          <p className="text-[13px] text-muted">
            {rapor.provisional ? 'Provisional' : 'Complete'} · predikat{' '}
            <span data-figure="rapor.predikat">{rapor.predikat}</span>
          </p>
        </Card>
        <Card
          title="Filled from data"
          info="A.1 realisation, A.3 complaint handling, C.3 attendance discipline and D.3 report quality. Everything else needs a person: training, grooming, equipment condition and the rest are not visible in a chat group."
        >
          <p className="font-[family-name:var(--font-display)] text-[38px] leading-[1.15] tabular-nums">
            <span data-figure="rapor.auto_filled">{AUTO_FILLED.length}</span>
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
        <IndicatorTable rapor={rapor} />
      </section>
    </>
  )
}
