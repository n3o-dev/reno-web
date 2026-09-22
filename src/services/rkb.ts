import { readFile } from 'node:fs/promises'
import { cache } from 'react'
import { parseWorkbook, type Sheet, type Workbook } from '@/rkb/read'
import type { PlanCell } from '@/rules/realisation'
import type { Evidence } from '@/services/evidence'
import type { RkbBlockRecord, RkbMatchRecord } from '@/contract/schemas'

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
 * when the workbook says so or the agent matched a report to it.
 */
export function planCells(
  sheet: Sheet,
  month: string,
  matches: readonly RkbMatchRecord[] = [],
  blocks: readonly RkbBlockRecord[] = [],
): readonly PlanCell[] {
  // `rkb_match` is the record that links a work report to a job row on a
  // date. It existed in the contract and fed nothing, so a cell was "done"
  // only if Reno had already typed it into the workbook, and no RKB figure
  // could cite a message.
  const matched = new Map(matches.map((m) => [`${m.job_row_id}|${m.date}`, m]))
  const blocked = new Map(blocks.map((b) => [`${b.job_row_id}|${b.date}`, b]))

  const cells: PlanCell[] = []
  for (const section of sheet.sections) {
    for (const row of section.rows) {
      for (const day of row.days) {
        if (day.planned === null || day.planned <= 0) continue
        const id = jobRowId(sheet.name, section.name, row.no)
        const date = `${month}-${String(day.day).padStart(2, '0')}`
        const match = matched.get(`${id}|${date}`)
        const block = blocked.get(`${id}|${date}`)
        cells.push({
          job_row_id: id,
          date,
          planned: true,
          /*
           * A blocked cell is never done. The workbook can disagree — Reno's
           * July Facade sheet is filled in for the day the gondola never
           * arrived — and when it does, the block wins: someone said in
           * writing that the work could not start, and net is
           * done / (planned - blocked), so counting a cell as both put
           * Facade at 104%.
           */
          done:
            block === undefined &&
            (match !== undefined || (day.actual !== null && day.actual > 0)),
          /*
           * From an `rkb_block` record, which is the ninth record type and
           * exists for this: until it did, nothing the agent could emit
           * would set this, so net realisation was arithmetically identical
           * to gross and the client saw two figures that could not diverge.
           *
           * A block's own message is the citation. The envelope requires
           * one, so an uncited block is unrepresentable rather than
           * rejected.
           */
          blocked: block !== undefined,
          source_message_id: block?.source_message_id ?? match?.source_message_id ?? null,
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
