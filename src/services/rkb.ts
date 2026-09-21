import { readFile } from 'node:fs/promises'
import { cache } from 'react'
import { parseWorkbook, type Sheet, type Workbook } from '@/rkb/read'
import type { PlanCell } from '@/rules/realisation'
import type { Evidence } from '@/services/evidence'

/**
 * The RKB workbook behind the realisation screen.
 *
 * Reads Reno's own file. The plan is frozen for the month (ADR-0004), so a
 * job row is identified by where it sits: sheet, section, and the NO column.
 */
const WORKBOOK = 'fixtures/rkb/RKB_JULI_2026.xlsx'

export const getWorkbook = cache(async (path: string = WORKBOOK): Promise<Workbook> => {
  return parseWorkbook(new Uint8Array(await readFile(path)))
})

/** `toilet:TOILET LT 2:3` — the id the agent's `rkb_match` records carry. */
export function jobRowId(sheetName: string, sectionName: string, no: number): string {
  const sheet = sheetName
    .replace(/^RKB\s+/i, '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
  return `${sheet}:${sectionName}:${no}`
}

/** A slug for the sheet's own route. */
export const sheetSlug = (sheetName: string): string =>
  sheetName.replace(/^RKB\s+/i, '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-')

/**
 * The workbook's R and A columns as plan cells.
 *
 * A cell counts as planned when R carries a number above zero, and as done
 * when A does. `blocked` is always false here: the workbook has no way to say
 * blocked — Reno never agreed to a marker for it — so blocks arrive from the
 * agent's records and are merged in by the caller.
 */
export function planCells(sheet: Sheet, month: string): readonly PlanCell[] {
  const cells: PlanCell[] = []
  for (const section of sheet.sections) {
    for (const row of section.rows) {
      for (const day of row.days) {
        if (day.planned === null || day.planned <= 0) continue
        cells.push({
          job_row_id: jobRowId(sheet.name, section.name, row.no),
          date: `${month}-${String(day.day).padStart(2, '0')}`,
          planned: true,
          done: day.actual !== null && day.actual > 0,
          blocked: false,
          // The workbook is the evidence for its own cells; a report-level
          // citation only exists once the agent has matched one.
          source_message_id: null,
        })
      }
    }
  }
  return cells
}

/** The month the loaded workbook covers. Named in the file, not inferred. */
export const WORKBOOK_MONTH = '2026-07'
export const WORKBOOK_LABEL = 'RKB Juli 2026'

/**
 * What an RKB figure points at.
 *
 * Not a message: these numbers are read out of Reno's own workbook, and the
 * thing to check is the sheet and the rows. A planned row nobody reported has
 * no message behind it at all — that is the point of the figure.
 */
export function workbookEvidence(sheetName: string, rows: readonly number[]): Evidence {
  const first = rows.at(0)
  const last = rows.at(-1)
  return {
    kind: 'workbook',
    file: 'RKB_JULI_2026.xlsx',
    sheet: sheetName.trim(),
    ref:
      first === undefined || last === undefined
        ? 'no job rows'
        : `R and A columns, rows ${first}–${last}`,
  }
}
