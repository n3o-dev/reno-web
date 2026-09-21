import { ScreenHeader } from '@/components/common/ScreenHeader'
import { Card } from '@/components/styled/Card'
import { Figure } from '@/components/common/Figure'
import { computeRealisation } from '@/rules/realisation'
import {
  WORKBOOK_LABEL,
  WORKBOOK_MONTH,
  getWorkbook,
  planCells,
  sheetSlug,
  workbookEvidence,
} from '@/services/rkb'
import { SheetRealisation, type SheetSummary } from '@/components/screens/parts/SheetRealisation'
import { SITE_ID } from '@/services/report'
import { getRecords } from '@/services/records'

const percent = (value: number | null): string =>
  value === null ? '—' : `${Math.round(value * 100)}%`

interface RkbScreenProps {
  /** Where a sheet link points; the client link lives under its token. */
  readonly basePath?: string
  /** Set on the client surface. The workbook belongs to one site. */
  readonly siteId?: string
}

export async function RkbScreen({ basePath = '/rkb', siteId }: RkbScreenProps = {}) {
  // The loaded workbook is this site's. Another site's token must not see
  // its plan, let alone its realisation.
  if (siteId !== undefined && siteId !== SITE_ID) {
    return (
      <>
        <ScreenHeader
          title="RKB Realisation"
          question="What was planned, what was done, what was blocked"
        />
        <p className="text-[14px] text-muted">No RKB workbook has been loaded for this site.</p>
      </>
    )
  }

  const [book, records] = await Promise.all([getWorkbook(), getRecords(siteId)])
  const matches = records.rkbMatches
  const sheets: SheetSummary[] = book.sheets.map((sheet) => ({
    name: sheet.name,
    slug: sheetSlug(sheet.name),
    sections: sheet.sections.length,
    rows: sheet.sections.reduce((n, s) => n + s.rows.length, 0),
    realisation: computeRealisation(planCells(sheet, WORKBOOK_MONTH, matches)),
    evidence: workbookEvidence(
      sheet.name,
      sheet.sections.flatMap((s) => s.rows.map((r) => r.rowNumber)),
    ),
  }))
  const evidence = book.sheets.map((sheet) =>
    workbookEvidence(
      sheet.name,
      sheet.sections.flatMap((s) => s.rows.map((r) => r.rowNumber)),
    ),
  )
  const whole = computeRealisation(
    book.sheets.flatMap((sheet) => planCells(sheet, WORKBOOK_MONTH, matches)),
  )

  return (
    <>
      <ScreenHeader
        title="RKB Realisation"
        question="What was planned, what was done, what was blocked"
      />
      <div className="grid gap-4 md:grid-cols-3">
        <Card
          title="Realisation"
          info="Job-row days marked done in column A, over the job-row days planned in column R. Net excludes rows that were blocked by something outside Reno's control; gross counts them against Reno. The client sees both. This is the only completion percentage in the dashboard."
        >
          <p className="font-[family-name:var(--font-display)] text-[38px] leading-[1.15] tabular-nums">
            <Figure name="rkb.net" kind="completion" evidence={evidence} total={evidence.length}>
              {percent(whole.net)}
            </Figure>
          </p>
          <p className="text-[13px] text-muted">
            Gross{' '}
            <Figure name="rkb.gross" kind="completion" evidence={evidence} total={evidence.length} className="tabular-nums">
              {percent(whole.gross)}
            </Figure>{' '}
            · {WORKBOOK_LABEL}
          </p>
        </Card>
        <Card
          title="Planned job-row days"
          info="One job row on one day with a number in column R. The workbook's own JUMLAH row counts the same thing per section; this is the whole file."
        >
          <p className="font-[family-name:var(--font-display)] text-[38px] leading-[1.15] tabular-nums">
            <Figure name="rkb.planned" evidence={evidence} total={evidence.length}>
              {whole.planned}
            </Figure>
          </p>
        </Card>
        <Card
          title="Blocked"
          info="A job row that could not proceed for a reason outside Reno's control. This reads zero for a structural reason, not a happy one: no record type in the agent contract can mark a job row blocked, so nothing can ever set it. Net realisation is therefore arithmetically identical to gross until that record exists. Complaints and work orders do carry a blocked state and are shown as paused on their own screens."
        >
          <p className="font-[family-name:var(--font-display)] text-[38px] leading-[1.15] tabular-nums">
            <Figure
              name="rkb.blocked"
              evidence={[
                {
                  kind: 'absent',
                  reason:
                    'No record type can mark an RKB job row blocked, so this cannot yet be anything but zero. Raised with the agent team.',
                },
              ]}
              total={1}
            >
              {whole.blocked}
            </Figure>
          </p>
        </Card>
      </div>
      <section className="mt-4 rounded-[var(--radius-card)] border border-line bg-surface p-5">
        <h2 className="mb-2 font-[family-name:var(--font-display)] text-[17px]">By sheet</h2>
        <SheetRealisation sheets={sheets} basePath={basePath} />
      </section>
    </>
  )
}
