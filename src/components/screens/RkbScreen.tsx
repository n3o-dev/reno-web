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

const percent = (value: number | null): string =>
  value === null ? '—' : `${Math.round(value * 100)}%`

interface RkbScreenProps {
  /** Where a sheet link points; the client link lives under its token. */
  readonly basePath?: string
}

export async function RkbScreen({ basePath = '/rkb' }: RkbScreenProps = {}) {
  const book = await getWorkbook()
  const sheets: SheetSummary[] = book.sheets.map((sheet) => ({
    name: sheet.name,
    slug: sheetSlug(sheet.name),
    sections: sheet.sections.length,
    rows: sheet.sections.reduce((n, s) => n + s.rows.length, 0),
    realisation: computeRealisation(planCells(sheet, WORKBOOK_MONTH)),
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
    book.sheets.flatMap((sheet) => planCells(sheet, WORKBOOK_MONTH)),
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
          info="A job row that could not proceed for a reason outside Reno's control, each citing the message that says so. The workbook itself has no way to record this — Reno never agreed to a marker for it — so blocks come from the group and are shown here, never written into the file."
        >
          <p className="font-[family-name:var(--font-display)] text-[38px] leading-[1.15] tabular-nums">
            <Figure
              name="rkb.blocked"
              evidence={[
                {
                  kind: 'absent',
                  reason:
                    'The workbook cannot record a block. Blocks arrive from the group and none was matched to this plan.',
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
