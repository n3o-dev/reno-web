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
    const blocks = book.sheets.flatMap((s) => s.sections)
    expect(rows).toHaveLength(144)
    expect(blocks).toHaveLength(21)
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

  it('carries the location and job text of each row', () => {
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
