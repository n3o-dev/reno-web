import type { RkbMatchRecord } from '@/contract/schemas'
import type { Workbook } from '@/rkb/read'
import { writeActuals, type ActualEdit, type WriteResult } from '@/rkb/write'
import { jobRowId } from '@/services/rkb'

/**
 * Turns the month's matches into writes in Reno's own workbook.
 *
 * Every planned job-row day gets an A value: 1 where a work report was
 * matched to it, 0 where none was. A planned cell left blank would read as
 * "not yet filled in" to whoever opens the file, which is the ambiguity this
 * whole system exists to remove — Reno's July file has 118 planned toilet
 * cells and two actuals, and nobody can tell which of those is a gap in the
 * work and which a gap in the paperwork.
 *
 * Cells that were not planned are left alone. Writing a 0 into a day nobody
 * scheduled would invent a commitment.
 *
 * See docs/specs/monthly-report-pack.md (AC-1)
 */
const key = (jobRow: string, date: string): string => `${jobRow}|${date}`

export function matchKeys(matches: readonly RkbMatchRecord[]): ReadonlySet<string> {
  return new Set(matches.map((m) => key(m.job_row_id, m.date)))
}

export interface ExportPlan {
  readonly edits: readonly ActualEdit[]
  readonly planned: number
  readonly done: number
  /** Cells Reno had already filled in, left untouched. */
  readonly preserved: number
}

export function planExport(
  workbook: Workbook,
  matched: ReadonlySet<string>,
  month: string,
): ExportPlan {
  const edits: ActualEdit[] = []
  let done = 0
  let preserved = 0

  for (const sheet of workbook.sheets) {
    for (const section of sheet.sections) {
      for (const row of section.rows) {
        const id = jobRowId(sheet.name, section.name, row.no)
        for (const day of row.days) {
          if (day.planned === null || day.planned <= 0) continue
          const date = `${month}-${String(day.day).padStart(2, '0')}`
            const isDone = matched.has(key(id, date))
          if (isDone) done += 1

          /*
           * A cell Reno already filled in by hand is left alone unless the
           * agent has something to say about it. Writing 0 over every
           * unmatched planned cell destroyed all 268 values typed into the
           * July workbook — the agent has one match, so the export replaced
           * a month of realisation with a single 1 and 532 zeroes.
           *
           * Blank still becomes 0: that is the ambiguity worth removing,
           * and it destroys nothing.
           */
          const alreadyFilled = day.actual !== null
          if (!isDone && alreadyFilled) {
            preserved += 1
            continue
          }
          edits.push({
            sheet: sheet.name,
            rowNumber: row.rowNumber,
            day: day.day,
            value: isDone ? 1 : 0,
          })
        }
      }
    }
  }

  return { edits, planned: edits.length + preserved, done, preserved }
}

/**
 * Writes the month's realisation into the workbook and hands back the bytes.
 *
 * The result carries whatever the writer could not do: totals the workbook
 * states as literals rather than formulas will not have moved, and saying so
 * is better than letting Reno find a stale number themselves.
 */
export function exportRkb(
  original: Uint8Array,
  workbook: Workbook,
  matches: readonly RkbMatchRecord[],
  month: string,
): WriteResult & { readonly plan: ExportPlan } {
  const plan = planExport(workbook, matchKeys(matches), month)
  return { ...writeActuals(original, plan.edits), plan }
}
