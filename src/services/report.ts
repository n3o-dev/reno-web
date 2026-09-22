import { buildReportPack, type ReportPack } from '@/report/model'
import type { SlotDayOverride } from '@/services/overrides'
import { checkGates, monthConfirmation, type Confirmation, type Gate } from '@/report/gates'
import { getRecords } from '@/services/records'
import { getDatabase } from '@/services/database'
import { WORKBOOK_LABEL, WORKBOOK_MONTH, getWorkbook } from '@/services/rkb'
import { getContract } from '@/services/contract'
import { getSlotOverrides } from '@/services/overrides'
import { narrowToMonth } from '@/report/period'

/**
 * Assembles the month's pack and checks whether it may be generated.
 *
 * One entry point for the screen, the print view and the downloads, so all
 * three are looking at the same month and the same gates.
 */
export interface MonthReport {
  readonly pack: ReportPack
  readonly corrections: readonly SlotDayOverride[]
  readonly gates: readonly Gate[]
  readonly confirmation: Confirmation | null
  readonly generatable: boolean
}

export const SITE_ID = 'lwas'
export const SITE_LABEL = 'Living World Alam Sutera'

/**
 * The site whose workbook and contract this deployment holds.
 *
 * A client link is scoped to one site. Everything below must be narrowed to
 * it, not just the records: the workbook and the contract are one site's too,
 * and a token for another site that still saw them would be the leak the
 * scoping exists to prevent.
 */
export async function monthReport(month: string, siteId?: string): Promise<MonthReport> {
  const [source, workbook, contract, corrections] = await Promise.all([
    getRecords(siteId),
    getWorkbook(),
    getContract(),
    getSlotOverrides(),
  ])
  const db = getDatabase()
  const confirmation =
    db === null ? null : await monthConfirmation(db.sql, siteId ?? SITE_ID, month)

  // Another site's token gets this site's records narrowed to nothing; it
  // must also get no workbook and no contract.
  const ours = siteId === undefined || siteId === SITE_ID
  /*
   * Everything this site knows is withheld from another site's token, not
   * just its records: the contracted rate is the most commercially
   * sensitive number in the file, and the workbook's name and the site's
   * own label identify the client.
   */
  const pack = buildReportPack({
    source,
    workbook,
    month,
    workbookLabel: ours ? WORKBOOK_LABEL : 'No workbook for this site',
    siteId: siteId ?? SITE_ID,
    siteLabel: ours ? SITE_LABEL : 'This site',
    corrections: ours ? corrections : [],
    workbookMonth: ours ? WORKBOOK_MONTH : 'no workbook for this site',
    contract: ours
      ? contract
      : { ...contract, slots: null, monthly_rate_per_mp: 0 },
  })
  /*
   * The same month the pack reads. Gating on the whole record set meant one
   * uncited block in September blocked generation for every month
   * including 2099, and the refusal named a record outside the month it
   * refused.
   */
  const gates = checkGates({ source: narrowToMonth(source, month), confirmation, month })

  return {
    pack,
    gates,
    confirmation,
    corrections: ours ? corrections : [],
    generatable: gates.every((gate) => gate.passed),
  }
}
