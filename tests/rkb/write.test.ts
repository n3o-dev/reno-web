import { describe, expect, it } from 'vitest'
import { readFile } from 'node:fs/promises'
import { unzipSync, zipSync, strFromU8, strToU8 } from 'fflate'
import { XMLValidator } from 'fast-xml-parser'
import { parseWorkbook } from '@/rkb/read'
import { writeActuals, type ActualEdit } from '@/rkb/write'

const WORKBOOK = 'fixtures/rkb/RKB_JULI_2026.xlsx'
const original = new Uint8Array(await readFile(WORKBOOK))

const rowOf = (bytes: Uint8Array, sheet: string, no: number) => {
  const book = parseWorkbook(bytes)
  return book.sheets
    .find((s) => s.name === sheet)
    ?.sections.flatMap((x) => x.rows)
    .find((r) => r.no === no)
}

describe('AC-6 · A values land in the right cell for all three layouts', () => {
  it.each([
    // sheet, NO, day, expected A cell — layouts B and C sit one column right
    ['RKB TOILET ', 1, 3, 'I12'],
    ['RKB FACADE', 1, 3, 'K12'],
    ['RKB RUANG UTILITY', 1, 3, 'K12'],
  ])('%s row %i day %i → %s', (sheet, no, day, expected) => {
    const row = rowOf(original, sheet as string, no as number)
    expect(row?.rowNumber).toBe(12)
    expect(`${row?.days[(day as number) - 1]?.aColumn}${row?.rowNumber}`).toBe(expected)
  })

  it('writes the value into that cell and reads it back', () => {
    const edits: ActualEdit[] = [{ sheet: 'RKB TOILET ', rowNumber: 12, day: 3, value: 1 }]
    const out = writeActuals(original, edits).bytes
    expect(rowOf(out, 'RKB TOILET ', 1)?.days[2]?.actual).toBe(1)
    // Untouched in the original, so this proves the write, not the fixture.
    expect(rowOf(original, 'RKB TOILET ', 1)?.days[2]?.actual).toBeNull()
  })

  it('fills a cell that exists but holds no value', () => {
    // O12 is present in the XML with a style but no <v> — day 6 on Toilet
    // row 12. Every cell in this workbook exists; only some hold values.
    const out = writeActuals(original, [
      { sheet: 'RKB TOILET ', rowNumber: 12, day: 6, value: 1 },
    ]).bytes
    expect(rowOf(out, 'RKB TOILET ', 1)?.days[5]?.actual).toBe(1)
    expect(rowOf(out, 'RKB TOILET ', 1)?.days[5]?.planned).toBe(1)
  })

  it('keeps the cell’s own formatting when filling it', () => {
    const out = writeActuals(original, [
      { sheet: 'RKB TOILET ', rowNumber: 12, day: 6, value: 1 },
    ]).bytes
    const xml = strFromU8(unzipSync(out)['xl/worksheets/sheet2.xml'] as Uint8Array)
    const styleOf = (ref: string, doc: string): string | null =>
      /\ss="(\d+)"/.exec(new RegExp(`<c[^>]*r="${ref}"[^>]*>`).exec(doc)?.[0] ?? '')?.[1] ?? null
    const before = strFromU8(unzipSync(original)['xl/worksheets/sheet2.xml'] as Uint8Array)
    // A columns carry their own style (132) distinct from the R columns (105);
    // filling a cell must not silently restyle it to its left-hand neighbour.
    expect(styleOf('O12', xml)).toBe(styleOf('O12', before))
    expect(styleOf('O12', xml)).not.toBe(styleOf('N12', xml))
  })

  describe('a workbook that omits empty cells, as Excel often writes them', () => {
    /** Strips O12 entirely so the insert path is actually exercised. */
    const stripped = ((): Uint8Array => {
      const entries = unzipSync(original)
      const xml = strFromU8(entries['xl/worksheets/sheet2.xml'] as Uint8Array)
      const without = xml.replace(/<c [^>]*r="O12"[^>]*?(?:\/>|>.*?<\/c>)/, '')
      return zipSync({ ...entries, 'xl/worksheets/sheet2.xml': strToU8(without) })
    })()

    it('starts from a file where the cell really is absent', () => {
      const xml = strFromU8(unzipSync(stripped)['xl/worksheets/sheet2.xml'] as Uint8Array)
      expect(xml).not.toContain('r="O12"')
    })

    it('inserts the missing cell and reads it back', () => {
      const out = writeActuals(stripped, [
        { sheet: 'RKB TOILET ', rowNumber: 12, day: 6, value: 1 },
      ]).bytes
      expect(rowOf(out, 'RKB TOILET ', 1)?.days[5]?.actual).toBe(1)
    })

    it('borrows a neighbour’s formatting for the inserted cell', () => {
      const out = writeActuals(stripped, [
        { sheet: 'RKB TOILET ', rowNumber: 12, day: 6, value: 1 },
      ]).bytes
      const xml = strFromU8(unzipSync(out)['xl/worksheets/sheet2.xml'] as Uint8Array)
      const inserted = /<c[^>]*r="O12"[^>]*>/.exec(xml)?.[0] ?? ''
      expect(/\ss="\d+"/.test(inserted)).toBe(true)
    })

    it('inserts in column order, not at the end of the row', () => {
      const out = writeActuals(stripped, [
        { sheet: 'RKB TOILET ', rowNumber: 12, day: 6, value: 1 },
      ]).bytes
      const xml = strFromU8(unzipSync(out)['xl/worksheets/sheet2.xml'] as Uint8Array)
      const rowStart = xml.indexOf('<row r="12"')
      const body = xml.slice(rowStart, xml.indexOf('</row>', rowStart))
      const columns = [...body.matchAll(/<c[^>]*r="([A-Z]+)12"/g)].map((m) => m[1] as string)
      const index = (c: string): number =>
        [...c].reduce((n, ch) => n * 26 + (ch.charCodeAt(0) - 64), 0)
      expect(columns).toContain('O')
      expect(columns.map(index)).toEqual([...columns.map(index)].sort((a, b) => a - b))
    })
  })

  it('writes to layouts B and C at their shifted offsets', () => {
    const out = writeActuals(original, [
      { sheet: 'RKB FACADE', rowNumber: 12, day: 3, value: 1 },
      { sheet: 'RKB RUANG UTILITY', rowNumber: 12, day: 3, value: 1 },
    ]).bytes
    expect(rowOf(out, 'RKB FACADE', 1)?.days[2]?.actual).toBe(1)
    expect(rowOf(out, 'RKB RUANG UTILITY', 1)?.days[2]?.actual).toBe(1)
  })

  it('refuses an edit naming a sheet that does not exist', () => {
    expect(() =>
      writeActuals(original, [{ sheet: 'RKB BASEMENT', rowNumber: 12, day: 1, value: 1 }]).bytes,
    ).toThrowError(/RKB BASEMENT/)
  })

  it('refuses an edit naming a row that is not a job row', () => {
    expect(() =>
      writeActuals(original, [{ sheet: 'RKB TOILET ', rowNumber: 9999, day: 1, value: 1 }]).bytes,
    ).toThrowError(/9999/)
  })

  it('refuses a day outside 1..31 by name, not by falling off the array', () => {
    for (const day of [0, 32, -1, 1.5]) {
      expect(() =>
        writeActuals(original, [{ sheet: 'RKB TOILET ', rowNumber: 12, day, value: 1 }]).bytes,
      ).toThrowError(/outside 1\.\.31/)
    }
  })
})

describe('AC-5 · the output is Reno’s file with only the A cells changed', () => {
  // Day 5 on Facade, not day 3: day 3 already holds 1, so writing it back is a
  // genuine no-op and the sheet would be byte-identical. Pinned separately below.
  const edits: ActualEdit[] = [
    { sheet: 'RKB TOILET ', rowNumber: 12, day: 3, value: 1 },
    { sheet: 'RKB FACADE', rowNumber: 12, day: 5, value: 1 },
  ]
  const out = writeActuals(original, edits).bytes

  it('keeps every zip entry, none added and none dropped', () => {
    const before = Object.keys(unzipSync(original)).sort()
    const after = Object.keys(unzipSync(out)).sort()
    expect(after).toEqual(before)
  })

  it('leaves every entry other than the two edited sheets byte-identical', () => {
    const before = unzipSync(original)
    const after = unzipSync(out)
    const changed = Object.keys(before).filter(
      (path) => Buffer.compare(Buffer.from(before[path] as Uint8Array), Buffer.from(after[path] as Uint8Array)) !== 0,
    )
    expect(changed.sort()).toEqual(['xl/worksheets/sheet2.xml', 'xl/worksheets/sheet4.xml'])
  })

  it('preserves the sheet names, including the trailing space Reno typed', () => {
    expect(parseWorkbook(out).sheets.map((s) => s.name)).toEqual(
      parseWorkbook(original).sheets.map((s) => s.name),
    )
  })

  it('preserves column widths, merged cells and the drawing references', () => {
    const before = strFromU8(unzipSync(original)['xl/worksheets/sheet2.xml'] as Uint8Array)
    const after = strFromU8(unzipSync(out)['xl/worksheets/sheet2.xml'] as Uint8Array)
    for (const tag of ['<cols', '<mergeCells', '<drawing', '<pageMargins', '<sheetFormatPr']) {
      expect(after.includes(tag), `${tag} survived`).toBe(before.includes(tag))
    }
  })

  it('changes nothing structural in the parsed model except the A values', () => {
    const a = parseWorkbook(original)
    const b = parseWorkbook(out)
    const strip = (book: typeof a) =>
      book.sheets.map((s) => ({
        name: s.name,
        layout: s.layout,
        sections: s.sections.map((x) => ({
          name: x.name,
          totals: x.totalsRows,
          rows: x.rows.map((r) => ({
            no: r.no,
            area: r.area,
            subject: r.subject,
            work: r.work,
            rowNumber: r.rowNumber,
            planned: r.days.map((d) => d.planned),
            nonWorking: r.days.map((d) => d.isNonWorkingDay),
          })),
        })),
      }))
    expect(strip(b)).toEqual(strip(a))
  })

  it('writes nothing when the value is already what the file says', () => {
    // Facade day 3 already holds 1. Re-writing it must not churn the file,
    // so re-running an export after no change produces an identical artifact.
    const before = unzipSync(original)['xl/worksheets/sheet4.xml'] as Uint8Array
    const same = writeActuals(original, [
      { sheet: 'RKB FACADE', rowNumber: 12, day: 3, value: 1 },
    ]).bytes
    const after = unzipSync(same)['xl/worksheets/sheet4.xml'] as Uint8Array
    expect(Buffer.compare(Buffer.from(before), Buffer.from(after))).toBe(0)
  })

  /**
   * String surgery on XML can produce something that still unzips but no
   * longer parses. Verified independently with openpyxl during development —
   * it opens the output, sees all six sheets and reads 830 merged ranges and
   * 4 column widths unchanged — and pinned here so a regression cannot ship.
   */
  it('leaves every XML part well-formed', () => {
    const parts = unzipSync(out)
    const malformed = Object.keys(parts)
      .filter((path) => path.endsWith('.xml') || path.endsWith('.rels'))
      .filter((path) => XMLValidator.validate(strFromU8(parts[path] as Uint8Array)) !== true)
    expect(malformed).toEqual([])
  })

  it('writes a number, not a shared-string reference Excel would misread', () => {
    const xml = strFromU8(unzipSync(out)['xl/worksheets/sheet2.xml'] as Uint8Array)
    const cell = /<c[^>]*r="I12"[^>]*>.*?<\/c>/.exec(xml)?.[0] ?? ''
    expect(cell).toContain('<v>1</v>')
    expect(cell).not.toContain('t="s"')
  })

  it('is a no-op when there are no edits', () => {
    const untouched = writeActuals(original, []).bytes
    const before = unzipSync(original)
    const after = unzipSync(untouched)
    for (const path of Object.keys(before)) {
      expect(
        Buffer.compare(Buffer.from(before[path] as Uint8Array), Buffer.from(after[path] as Uint8Array)),
        path,
      ).toBe(0)
    }
  })
})
