import { describe, expect, it } from 'vitest'
import { readWorkbook } from '@/rkb/read'

const WORKBOOK = 'fixtures/rkb/RKB_JULI_2026.xlsx'
const book = await readWorkbook(WORKBOOK)

describe('AC-1 · the reader parses Reno’s workbook as it actually is', () => {
  it('finds all six sheets', () => {
    expect(book.sheets.map((s) => s.name)).toEqual([
      'RKB Koridor dalam',
      'RKB TOILET ',
      'RKB CAR PARK',
      'RKB FACADE',
      'RKB RUANG UTILITY',
      'RKB FOOD COURT',
    ])
  })

  it('yields 144 job rows across 21 sections', () => {
    const rows = book.sheets.flatMap((s) => s.sections.flatMap((b) => b.rows))
    const sections = book.sheets.flatMap((s) => s.sections)
    expect(rows).toHaveLength(144)
    expect(sections).toHaveLength(21)
  })

  it('splits per sheet as 39 / 25 / 36 / 7 / 29 / 8', () => {
    expect(book.sheets.map((s) => s.sections.flatMap((b) => b.rows).length)).toEqual([
      39, 25, 36, 7, 29, 8,
    ])
  })

  it('splits sections per sheet as 7 / 5 / 6 / 1 / 1 / 1', () => {
    expect(book.sheets.map((s) => s.sections.length)).toEqual([7, 5, 6, 1, 1, 1])
  })

  it('counts rows rather than trusting the NO column, which skips 5 on Ruang Utility', () => {
    const utility = book.sheets.find((s) => s.name === 'RKB RUANG UTILITY')
    const rows = utility?.sections.flatMap((b) => b.rows) ?? []
    expect(rows).toHaveLength(29)
    expect(Math.max(...rows.map((r) => r.no))).toBe(30)
    expect(rows.map((r) => r.no)).not.toContain(5)
  })

  it('carries the subject and work text of each row', () => {
    const toilet = book.sheets.find((s) => s.name === 'RKB TOILET ')
    const first = toilet?.sections[0]?.rows[0]
    expect(first?.subject).toBe('Cover lampu')
    expect(first?.work).toBe('Dusting')
  })

  it('names each section from its heading', () => {
    const toilet = book.sheets.find((s) => s.name === 'RKB TOILET ')
    expect(toilet?.sections.map((b) => b.name)).toEqual([
      'TOILET LT 3',
      'TOILET LT 2',
      'TOILET LT 1',
      'TOILET LT GF',
      'TOILET LT LG',
    ])
  })
})

describe('AC-2 · the layout is detected per sheet, never assumed', () => {
  const layoutOf = (name: string): string | undefined =>
    book.sheets.find((s) => s.name === name)?.layout.id

  it('resolves the four ordinary sheets to layout A', () => {
    expect(layoutOf('RKB Koridor dalam')).toBe('A')
    expect(layoutOf('RKB TOILET ')).toBe('A')
    expect(layoutOf('RKB CAR PARK')).toBe('A')
    expect(layoutOf('RKB FOOD COURT')).toBe('A')
  })

  it('resolves Facade to layout B, which adds a PROGRES column', () => {
    const facade = book.sheets.find((s) => s.name === 'RKB FACADE')
    expect(facade?.layout.id).toBe('B')
    expect(facade?.layout.discriminator).toBe('PROGRES')
  })

  it('resolves Ruang Utility to layout C, which adds a ZONA column', () => {
    const utility = book.sheets.find((s) => s.name === 'RKB RUANG UTILITY')
    expect(utility?.layout.id).toBe('C')
    expect(utility?.layout.discriminator).toBe('ZONA')
  })

  it('anchors B and C one column right of A', () => {
    const dayStart = (name: string): string | undefined =>
      book.sheets.find((s) => s.name === name)?.layout.firstDayColumn
    expect(dayStart('RKB TOILET ')).toBe('D')
    expect(dayStart('RKB FACADE')).toBe('F')
    expect(dayStart('RKB RUANG UTILITY')).toBe('F')
  })
})

describe('a matched report counts as done', () => {
  /*
   * `rkb_match` is how the agent says "this report is that job row on that
   * day". It sat in the contract feeding nothing, so a cell counted as done
   * only when Reno had already typed it into the workbook by hand — which
   * meant realisation measured the paperwork rather than the work.
   */
  it('marks a planned cell done when a match exists, and cites it', async () => {
    const { planCells, jobRowId } = await import('@/services/rkb')
    const sheet = book.sheets.find((s) => s.name === 'RKB CAR PARK')
    if (sheet === undefined) throw new Error('no car park sheet')

    // Car park has 138 planned cells and no actuals at all in Reno's file.
    expect(planCells(sheet, '2026-07').filter((c) => c.done)).toHaveLength(0)

    const section = sheet.sections[0]
    const row = section?.rows[0]
    const day = row?.days.find((d) => (d.planned ?? 0) > 0)
    if (section === undefined || row === undefined || day === undefined) {
      throw new Error('no planned car park cell')
    }
    const date = `2026-07-${String(day.day).padStart(2, '0')}`

    const withMatch = planCells(sheet, '2026-07', [
      {
        record_id: 'rm_1',
        site_id: 'lwas',
        source_message_id: 'msg_0_1',
        sent_at: '2026-07-31T10:00:00+07:00',
        sender_raw: 'Amartha',
        sender_person_id: null,
        confidence: 0.9,
        job_row_id: jobRowId(sheet.name, section.name, row.no),
        date,
        work_report_id: 'wr_1',
        matched_by: 'agent',
      },
    ])

    const done = withMatch.filter((c) => c.done)
    expect(done).toHaveLength(1)
    expect(done[0]?.date).toBe(date)
    // And the cell now cites the message, which is what makes the figure
    // traceable rather than just present.
    expect(done[0]?.source_message_id).toBe('msg_0_1')
  })
})
