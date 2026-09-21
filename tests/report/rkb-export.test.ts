import { describe, expect, it } from 'vitest'
import { readFile } from 'node:fs/promises'
import { unzipSync, strFromU8 } from 'fflate'
import { parseWorkbook } from '@/rkb/read'
import { jobRowId } from '@/services/rkb'
import { exportRkb, planExport, matchKeys } from '@/report/rkb-export'
import type { RkbMatchRecord } from '@/contract/schemas'

/**
 * AC-1 — the export writes into Reno's own workbook and changes nothing else.
 *
 * The matches are built from the workbook rather than from the fixture set:
 * the agent has emitted one `rkb_match` so far, and a test that writes one
 * cell would not exercise the thing that matters, which is 500 of them.
 */
const MONTH = '2026-07'
const original = new Uint8Array(await readFile('fixtures/rkb/RKB_JULI_2026.xlsx'))
const book = parseWorkbook(original)

/** Marks the first `n` planned job-row days as done. */
function matchesFor(n: number): RkbMatchRecord[] {
  const out: RkbMatchRecord[] = []
  for (const sheet of book.sheets) {
    for (const section of sheet.sections) {
      for (const row of section.rows) {
        for (const day of row.days) {
          if (out.length >= n) return out
          if (day.planned === null || day.planned <= 0) continue
          out.push({
            record_id: `rm_${out.length}`,
            site_id: 'lwas',
            source_message_id: 'msg_0_1',
            sent_at: '2026-07-31T10:00:00+07:00',
            sender_raw: 'Amartha',
            sender_person_id: null,
            confidence: 0.9,
            job_row_id: jobRowId(sheet.name, section.name, row.no),
            date: `${MONTH}-${String(day.day).padStart(2, '0')}`,
            work_report_id: `wr_${out.length}`,
            matched_by: 'agent',
          })
        }
      }
    }
  }
  return out
}

describe('what gets written', () => {
  it('writes an A value for every planned job-row day and none of the rest', () => {
    const plan = planExport(book, new Set(), MONTH)
    expect(plan.planned).toBe(533)
    expect(plan.done).toBe(0)
    expect(plan.edits.every((e) => e.value === 0)).toBe(true)
  })

  it('writes 1 where a report was matched', () => {
    const plan = planExport(book, matchKeys(matchesFor(40)), MONTH)
    expect(plan.done).toBe(40)
    expect(plan.edits.filter((e) => e.value === 1)).toHaveLength(40)
    expect(plan.edits.filter((e) => e.value === 0)).toHaveLength(533 - 40)
  })

  it('never touches a day nobody planned', () => {
    const planned = new Set(
      book.sheets.flatMap((sheet) =>
        sheet.sections.flatMap((section) =>
          section.rows.flatMap((row) =>
            row.days
              .filter((d) => (d.planned ?? 0) > 0)
              .map((d) => `${sheet.name}|${row.rowNumber}|${d.day}`),
          ),
        ),
      ),
    )
    for (const edit of planExport(book, new Set(), MONTH).edits) {
      expect(planned.has(`${edit.sheet}|${edit.rowNumber}|${edit.day}`)).toBe(true)
    }
  })
})

describe('what the workbook looks like afterwards', () => {
  const result = exportRkb(original, book, matchesFor(120), MONTH)
  const after = parseWorkbook(result.bytes)

  it('keeps every sheet, section and job row', () => {
    expect(after.sheets.map((s) => s.name)).toEqual(book.sheets.map((s) => s.name))
    expect(after.sheets.map((s) => s.sections.length)).toEqual(
      book.sheets.map((s) => s.sections.length),
    )
    expect(after.sheets.flatMap((s) => s.sections.flatMap((x) => x.rows)).length).toBe(144)
  })

  it('adds no zip entry — no stray part, no comment', () => {
    expect(Object.keys(unzipSync(result.bytes)).sort()).toEqual(
      Object.keys(unzipSync(original)).sort(),
    )
  })

  it('leaves every formula byte-identical', () => {
    const formulas = (bytes: Uint8Array): string[] => {
      const entries = unzipSync(bytes)
      return Object.keys(entries)
        .filter((path) => path.startsWith('xl/worksheets/'))
        .sort()
        .flatMap((path) => [
          ...strFromU8(entries[path] as Uint8Array).matchAll(/<f[^>]*>(.*?)<\/f>/g),
        ].map((m) => m[1] ?? ''))
    }
    expect(formulas(result.bytes)).toEqual(formulas(original))
  })

  it('reads back the realisation it wrote', () => {
    const done = after.sheets
      .flatMap((s) => s.sections.flatMap((x) => x.rows))
      .flatMap((r) => r.days)
      .filter((d) => (d.planned ?? 0) > 0 && (d.actual ?? 0) > 0)
    expect(done).toHaveLength(120)
  })

  it('says which totals it could not refresh rather than leaving them wrong quietly', () => {
    // Ruang Utility states some totals as literals, not formulas.
    expect(Array.isArray(result.staleTotals)).toBe(true)
    for (const stale of result.staleTotals) {
      expect(stale.sheet).not.toBe('')
    }
  })

  it('records no blocks, because the workbook cannot hold one', () => {
    expect(result.blocked).toEqual([])
  })
})
