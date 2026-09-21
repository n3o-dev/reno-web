import { buildReportPack, type ReportPack } from '@/report/model'
import { checkGates, monthConfirmation, type Confirmation, type Gate } from '@/report/gates'
import { getRecords } from '@/services/records'
import { getDatabase } from '@/services/database'
import { WORKBOOK_LABEL, getWorkbook } from '@/services/rkb'
import { getContract } from '@/services/contract'

/**
 * Assembles the month's pack and checks whether it may be generated.
 *
 * One entry point for the screen, the print view and the downloads, so all
 * three are looking at the same month and the same gates.
 */
export interface MonthReport {
  readonly pack: ReportPack
  readonly gates: readonly Gate[]
  readonly confirmation: Confirmation | null
  readonly generatable: boolean
}

export const SITE_ID = 'lwas'
export const SITE_LABEL = 'Living World Alam Sutera'

export async function monthReport(month: string): Promise<MonthReport> {
  const [source, workbook, contract] = await Promise.all([
    getRecords(),
    getWorkbook(),
    getContract(),
  ])
  const db = getDatabase()
  const confirmation = db === null ? null : await monthConfirmation(db.sql, SITE_ID, month)

  const pack = buildReportPack({
    source,
    workbook,
    month,
    workbookLabel: WORKBOOK_LABEL,
    siteId: SITE_ID,
    siteLabel: SITE_LABEL,
    contract,
  })
  const gates = checkGates({ source, confirmation, month })

  return { pack, gates, confirmation, generatable: gates.every((gate) => gate.passed) }
}
