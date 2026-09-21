import { describe, expect, it } from 'vitest'
import {
  readWorkbook,
  parseWorkbook,
  RkbLayoutError,
  DAYS_IN_GRID,
  type Sheet,
  type JobRow,
} from '@/rkb/read'
import { readFacadeSchedule } from '@/rkb/facade'
import { zipSync, unzipSync, strToU8, strFromU8 } from 'fflate'
import { readFile } from 'node:fs/promises'

const WORKBOOK = 'fixtures/rkb/RKB_JULI_2026.xlsx'
const book = await readWorkbook(WORKBOOK)

const sheet = (name: string): Sheet | undefined => book.sheets.find((s) => s.name === name)
const firstRow = (name: string): JobRow | undefined => sheet(name)?.sections[0]?.rows[0]

describe('AC-3 · every job row exposes the full 31-day grid', () => {
  it.each([
    ['RKB TOILET ', 'A'],
    ['RKB FACADE', 'B'],
    ['RKB RUANG UTILITY', 'C'],
  ])('%s (layout %s) yields 31 day entries', (name) => {
    expect(firstRow(name)?.days).toHaveLength(DAYS_IN_GRID)
  })

  it('numbers the days 1 to 31 in order', () => {
    expect(firstRow('RKB TOILET ')?.days.map((d) => d.day)).toEqual(
      Array.from({ length: 31 }, (_, i) => i + 1),
    )
  })

  it('pairs an R and an A column two apart, starting at the layout’s anchor', () => {
    const days = firstRow('RKB TOILET ')?.days ?? []
    expect(days[0]?.rColumn).toBe('D')
    expect(days[0]?.aColumn).toBe('E')
    expect(days[1]?.rColumn).toBe('F')
    expect(days[2]?.rColumn).toBe('H')
  })

  it('anchors layouts B and C one column right', () => {
    expect(firstRow('RKB FACADE')?.days[0]?.rColumn).toBe('F')
    expect(firstRow('RKB RUANG UTILITY')?.days[0]?.rColumn).toBe('F')
  })

  it('reads the planned values Reno actually entered', () => {
    // Toilet LT 3, "Cover lampu / Dusting": planned on the 1st.
    const cover = firstRow('RKB TOILET ')
    expect(cover?.subject).toBe('Cover lampu')
    expect(cover?.days[0]?.planned).toBe(1)
  })

  // The A column is what this whole feature exists to fill, so its read path
  // is asserted directly rather than inferred from the R column beside it.
  it.each([
    ['RKB TOILET ', 'E'],
    ['RKB FACADE', 'G'],
    ['RKB RUANG UTILITY', 'G'],
  ])('%s reads the A value from column %s, not from R', (name, aColumn) => {
    const row = firstRow(name)
    const dayOne = row?.days[0]
    expect(dayOne?.aColumn).toBe(aColumn)
    expect(dayOne?.actual).toBe(1)
  })

  /**
   * Day 6 is the discriminating case: Toilet row 12 is planned (N6 = 1) and
   * not realised (O6 empty). On day 1 both columns hold 1, so a reader wired
   * to the wrong column would look correct there — this is the assertion that
   * actually pins A to the A column.
   */
  it('reads a planned-but-unrealised day as R=1, A=null', () => {
    const daySix = firstRow('RKB TOILET ')?.days[5]
    expect(daySix?.day).toBe(6)
    expect(daySix?.rColumn).toBe('N')
    expect(daySix?.aColumn).toBe('O')
    expect(daySix?.planned).toBe(1)
    expect(daySix?.actual).toBeNull()
  })

  it.each(['RKB TOILET ', 'RKB FACADE', 'RKB RUANG UTILITY'])(
    '%s marks every July 2026 weekend, on its own layout’s columns',
    (name) => {
      const days = firstRow(name)?.days ?? []
      const flagged = days.filter((d) => d.isNonWorkingDay).map((d) => d.day)
      // 1 July 2026 is a Wednesday, so the weekends are these eight days.
      expect(flagged).toEqual([4, 5, 11, 12, 18, 19, 25, 26])
    },
  )

  it('exposes the PROGRES column on layouts B and C rather than dropping it', () => {
    expect(firstRow('RKB FACADE')?.subject).toBe('SISI HOTEL')
    expect(firstRow('RKB FACADE')?.work).toContain('GLASS CLEANING')
    expect(firstRow('RKB RUANG UTILITY')?.subject).toBe('RUANG LVMDP')
    expect(firstRow('RKB RUANG UTILITY')?.work).toContain('SWEEPING')
  })

  it('locates the three totals rows on every sheet, wherever the label sits', () => {
    for (const s of book.sheets) {
      for (const section of s.sections) {
        expect(section.totalsRows.jumlah, `${s.name} jumlah`).not.toBeNull()
        expect(section.totalsRows.realisasi, `${s.name} realisasi`).not.toBeNull()
        expect(section.totalsRows.persentasi, `${s.name} persentasi`).not.toBeNull()
      }
    }
  })
})

describe('AC-4 · the Facade schedule is parsed, not dropped as free text', () => {
  const schedule = readFacadeSchedule(book)

  it('finds seven equipment bands with their date ranges', () => {
    expect(schedule.equipmentBands).toHaveLength(7)
    expect(schedule.equipmentBands[0]).toMatchObject({ from: 1, to: 6 })
    expect(schedule.equipmentBands[0]?.equipment.toLowerCase()).toContain('spider boom lift')
  })

  it('reads the gondola bands as separate ranges', () => {
    const ranges = schedule.equipmentBands.map((b) => `${b.from}-${b.to}`)
    expect(ranges).toEqual(['1-6', '7-11', '13-17', '18-22', '23-27', '28-29', '30-31'])
  })

  it('finds the six rain-contingency jobs', () => {
    expect(schedule.rainContingency).toHaveLength(6)
    expect(schedule.rainContingency.join(' ').toUpperCase()).toContain('GLASS CLEANING')
  })

  it('leaves a gap on day 12, which the workbook does not schedule', () => {
    const covered = new Set<number>()
    for (const band of schedule.equipmentBands) {
      for (let d = band.from; d <= band.to; d++) covered.add(d)
    }
    expect(covered.has(11)).toBe(true)
    expect(covered.has(12)).toBe(false)
    expect(covered.has(13)).toBe(true)
  })
})

describe('AC-9 · an unknown layout fails loudly and names the sheet', () => {
  it('throws RkbLayoutError naming the sheet and what was missing', async () => {
    const original = new Uint8Array(await readFile(WORKBOOK))
    const broken = breakHeaderOf(original, 'xl/worksheets/sheet2.xml')
    expect(() => parseWorkbook(broken)).toThrowError(RkbLayoutError)
    expect(() => parseWorkbook(broken)).toThrowError(/RKB TOILET/)
    expect(() => parseWorkbook(broken)).toThrowError(/header row/)
  })
})

/** Rewrites one sheet so no header row can be recognised. */
function breakHeaderOf(bytes: Uint8Array, sheetPath: string): Uint8Array {
  const entries = unzipSync(bytes)
  const xml = strFromU8(entries[sheetPath] as Uint8Array)
  const gutted = xml.replace(/<sheetData>[\s\S]*<\/sheetData>/, '<sheetData/>')
  return zipSync({ ...entries, [sheetPath]: strToU8(gutted) })
}
