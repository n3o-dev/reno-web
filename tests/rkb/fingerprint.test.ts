import { describe, expect, it } from 'vitest'
import { readFile } from 'node:fs/promises'
import { parseWorkbook, type JobRow, type Section, type Sheet, type Workbook } from '@/rkb/read'
import {
  assertPlanUnchanged,
  comparePlans,
  fingerprintPlan,
  PlanFrozenError,
} from '@/rkb/fingerprint'

/**
 * AC-16 — the plan is frozen for the month and the freeze is checked.
 *
 * The edits are applied to the parsed workbook rather than to the xlsx: what
 * is under test is whether a moved job row is caught, and building six
 * variant spreadsheets would test fflate, not this.
 */
const bytes = new Uint8Array(await readFile('fixtures/rkb/RKB_JULI_2026.xlsx'))
const book = parseWorkbook(bytes)

const withSections = (sheet: Sheet, sections: readonly Section[]): Sheet => ({ ...sheet, sections })
const withRows = (section: Section, rows: readonly JobRow[]): Section => ({ ...section, rows })

/** Applies `change` to the first section of the named sheet. */
function edit(name: string, change: (rows: readonly JobRow[]) => readonly JobRow[]): Workbook {
  return {
    ...book,
    sheets: book.sheets.map((sheet) =>
      sheet.name !== name
        ? sheet
        : withSections(sheet, [
            withRows(sheet.sections[0] as Section, change((sheet.sections[0] as Section).rows)),
            ...sheet.sections.slice(1),
          ]),
    ),
  }
}

describe('the fingerprint', () => {
  it('covers every job row in the workbook', () => {
    expect(fingerprintPlan(book).rows).toHaveLength(144)
  })

  it('is unchanged by re-reading the same file', () => {
    expect(comparePlans(fingerprintPlan(book), fingerprintPlan(parseWorkbook(bytes)))).toEqual({
      added: [],
      removed: [],
      reordered: false,
    })
  })
})

describe('an upload that moved a job row is refused', () => {
  it('names the row that was inserted', () => {
    const inserted = edit('RKB FACADE', (rows) => {
      const first = rows[0] as JobRow
      return [...rows, { ...first, no: 99, subject: 'SISI TIMUR' }]
    })
    expect(() => assertPlanUnchanged(book, inserted)).toThrowError(PlanFrozenError)
    expect(() => assertPlanUnchanged(book, inserted)).toThrowError(/FACADE › FACADE › 99/)
    expect(() => assertPlanUnchanged(book, inserted)).toThrowError(/frozen for the month/)
  })

  it('names the row that was deleted', () => {
    const deleted = edit('RKB FACADE', (rows) => rows.slice(1))
    expect(() => assertPlanUnchanged(book, deleted)).toThrowError(/removed .*FACADE › 1/)
  })

  it('reports a reorder even though the same rows are present', () => {
    const shuffled = edit('RKB FACADE', (rows) => [...rows].reverse())
    expect(() => assertPlanUnchanged(book, shuffled)).toThrowError(/reordered/)
  })

  it('tells the uploader what to do about it', () => {
    const deleted = edit('RKB FACADE', (rows) => rows.slice(1))
    expect(() => assertPlanUnchanged(book, deleted)).toThrowError(/start of next month/)
  })
})

describe('rewording an activity is free', () => {
  it('accepts a renamed job row', () => {
    const renamed = edit('RKB FACADE', (rows) =>
      rows.map((row, index) =>
        index === 0 ? { ...row, subject: 'SISI HOTEL (barat)', work: 'GLASS CLEANING' } : row,
      ),
    )
    expect(() => assertPlanUnchanged(book, renamed)).not.toThrow()
  })

  it('accepts a change to the days planned', () => {
    const replanned = edit('RKB FACADE', (rows) =>
      rows.map((row) => ({ ...row, days: row.days.map((d) => ({ ...d, planned: 1 })) })),
    )
    expect(() => assertPlanUnchanged(book, replanned)).not.toThrow()
  })
})
