import { describe, expect, it } from 'vitest'
import { readFile } from 'node:fs/promises'
import { unzipSync, zipSync, strFromU8, strToU8 } from 'fflate'
import { writeActuals } from '@/rkb/write'
import { parseWorkbook } from '@/rkb/read'

const original = new Uint8Array(await readFile('fixtures/rkb/RKB_JULI_2026.xlsx'))

/** Reads a cell's `<f>` formula and cached `<v>` from a sheet's XML. */
function cellOf(bytes: Uint8Array, sheetPath: string, ref: string): {
  formula: string | null
  cached: string | null
  isError: boolean
} {
  const xml = strFromU8(unzipSync(bytes)[sheetPath] as Uint8Array)
  const tag = new RegExp(`<c [^>]*r="${ref}"[^>]*?>.*?</c>`).exec(xml)?.[0] ?? ''
  return {
    formula: /<f>(.*?)<\/f>/.exec(tag)?.[1] ?? null,
    cached: /<v>(.*?)<\/v>/.exec(tag)?.[1] ?? null,
    isError: /\st="e"/.test(tag),
  }
}

const TOILET = 'xl/worksheets/sheet2.xml'

describe('AC-7 · the three totals rows recompute from the written values', () => {
  // Toilet section 1: JUMLAH row 17, REALISASI row 18, PERSENTASI row 19.
  // Day 6 is column N (R) / O (A); before the write, REALISASI N18 is 0.
  const out = writeActuals(original, [
    { sheet: 'RKB TOILET ', rowNumber: 12, day: 6, value: 1 },
  ]).bytes

  it('starts from a file where that column has nothing realised', () => {
    expect(cellOf(original, TOILET, 'N18').cached).toBe('0')
    expect(cellOf(original, TOILET, 'N17').cached).toBe('1')
  })

  it('refreshes the REALISASI cached value for the column written to', () => {
    expect(cellOf(out, TOILET, 'N18').cached).toBe('1')
  })

  it('refreshes PERSENTASI to match', () => {
    // REALISASI 1 over JUMLAH 1.
    expect(Number(cellOf(out, TOILET, 'N19').cached)).toBeCloseTo(1)
  })

  it('leaves JUMLAH alone, because writing an A cannot change the plan', () => {
    expect(cellOf(out, TOILET, 'N17').cached).toBe(cellOf(original, TOILET, 'N17').cached)
  })

  it('never rewrites Reno’s formulas, only their cached results', () => {
    for (const ref of ['N17', 'N18', 'N19', 'D17', 'D18', 'D19']) {
      expect(cellOf(out, TOILET, ref).formula, ref).toBe(cellOf(original, TOILET, ref).formula)
    }
  })

  it('leaves untouched columns exactly as they were', () => {
    for (const ref of ['D17', 'D18', 'D19', 'F17', 'F18', 'F19']) {
      expect(cellOf(out, TOILET, ref), ref).toEqual(cellOf(original, TOILET, ref))
    }
  })
})

describe('AC-7 · a zero denominator stays #DIV/0!, never a misleading 0%', () => {
  it('is #DIV/0! in the original where nothing is planned', () => {
    const before = cellOf(original, TOILET, 'J19')
    expect(before.cached).toBe('#DIV/0!')
    expect(before.isError).toBe(true)
    expect(cellOf(original, TOILET, 'J17').cached).toBe('0')
  })

  it('stays #DIV/0! after a write elsewhere on the sheet', () => {
    const out = writeActuals(original, [
      { sheet: 'RKB TOILET ', rowNumber: 12, day: 6, value: 1 },
    ]).bytes
    const after = cellOf(out, TOILET, 'J19')
    expect(after.cached).toBe('#DIV/0!')
    expect(after.isError).toBe(true)
  })

  it('stays #DIV/0! even when an A value is written into that very column', () => {
    // Day 4 is column J (R) / K (A). J17 (JUMLAH) is 0 — nothing is planned —
    // so the percentage has no denominator and must not become 0 or 100.
    const out = writeActuals(original, [
      { sheet: 'RKB TOILET ', rowNumber: 12, day: 4, value: 1 },
    ]).bytes
    expect(cellOf(out, TOILET, 'J18').cached).toBe('1')
    const pct = cellOf(out, TOILET, 'J19')
    expect(pct.cached).toBe('#DIV/0!')
    expect(pct.isError).toBe(true)
  })
})

describe('AC-7 · the refresh is confined to the section that was written', () => {
  it('does not touch another section’s totals on the same sheet', () => {
    const out = writeActuals(original, [
      { sheet: 'RKB TOILET ', rowNumber: 12, day: 6, value: 1 },
    ]).bytes
    // Section 2 computes at rows 31/32/33.
    for (const ref of ['N31', 'N32', 'N33']) {
      expect(cellOf(out, TOILET, ref), ref).toEqual(cellOf(original, TOILET, ref))
    }
  })
})

describe('AC-7 · the percentage is realised over planned, not the reverse', () => {
  // Day 1 on Toilet section 1: JUMLAH 4, REALISASI 2. Writing one more A makes
  // it 3 of 4 — a ratio that reads differently if the division is inverted.
  const out = writeActuals(original, [
    { sheet: 'RKB TOILET ', rowNumber: 14, day: 1, value: 1 },
  ]).bytes

  it('starts from 2 of 4', () => {
    expect(cellOf(original, TOILET, 'D17').cached).toBe('4')
    expect(cellOf(original, TOILET, 'D18').cached).toBe('2')
    expect(Number(cellOf(original, TOILET, 'D19').cached)).toBeCloseTo(0.5)
  })

  it('becomes 3 of 4, and the percentage is 0.75 not 1.33', () => {
    expect(cellOf(out, TOILET, 'D17').cached).toBe('4')
    expect(cellOf(out, TOILET, 'D18').cached).toBe('3')
    expect(Number(cellOf(out, TOILET, 'D19').cached)).toBeCloseTo(0.75)
  })
})

/** Rewrites one cell's raw XML, to reach states the pristine file does not hold. */
function doctor(bytes: Uint8Array, from: string, to: string): Uint8Array {
  const entries = unzipSync(bytes)
  const xml = strFromU8(entries[TOILET] as Uint8Array)
  if (!xml.includes(from)) throw new Error(`doctor: "${from}" not found`)
  return zipSync({ ...entries, [TOILET]: strToU8(xml.replace(from, to)) })
}

describe('AC-7 · the error flag tracks the denominator', () => {
  it('restores t="e" on a #DIV/0! cell that lost it', () => {
    // J17 (JUMLAH) is 0, so J19 must be an error cell. Strip the flag first.
    const stripped = doctor(original, '<c r="J19" s="111" t="e">', '<c r="J19" s="111">')
    expect(cellOf(stripped, TOILET, 'J19').isError).toBe(false)

    const out = writeActuals(stripped, [
      { sheet: 'RKB TOILET ', rowNumber: 12, day: 4, value: 1 },
    ]).bytes
    const pct = cellOf(out, TOILET, 'J19')
    expect(pct.isError).toBe(true)
    expect(pct.cached).toBe('#DIV/0!')
  })

  it('clears t="e" when the denominator is not zero', () => {
    // D17 (JUMLAH) is 4, so D19 must not be an error cell. Mark it wrongly.
    const marked = doctor(original, '<c r="D19" s="111">', '<c r="D19" s="111" t="e">')
    expect(cellOf(marked, TOILET, 'D19').isError).toBe(true)

    const out = writeActuals(marked, [
      { sheet: 'RKB TOILET ', rowNumber: 14, day: 1, value: 1 },
    ]).bytes
    const pct = cellOf(out, TOILET, 'D19')
    expect(pct.isError).toBe(false)
    expect(Number(pct.cached)).toBeCloseTo(0.75)
  })
})

describe('AC-7 · the last row of a section is inside the SUM range', () => {
  /**
   * Toilet section 1 spans rows 12-16 and REALISASI N18 is SUM(O11:O16), so
   * row 16 is the range's final row. An off-by-one in the range loop would
   * under-report every section whose last row did work, silently.
   */
  it('counts work done on a section’s final job row', () => {
    expect(cellOf(original, TOILET, 'N18').cached).toBe('0')
    const out = writeActuals(original, [
      { sheet: 'RKB TOILET ', rowNumber: 16, day: 6, value: 1 },
    ]).bytes
    expect(cellOf(out, TOILET, 'N18').cached).toBe('1')
  })

  it('counts work done on a section’s first job row too', () => {
    const out = writeActuals(original, [
      { sheet: 'RKB TOILET ', rowNumber: 12, day: 6, value: 1 },
    ]).bytes
    expect(cellOf(out, TOILET, 'N18').cached).toBe('1')
  })
})

describe('AC-7 · a totals shape we do not understand is refused, not guessed', () => {
  it('throws rather than silently leaving a total stale', () => {
    const broken = doctor(original, '<f>SUM(O11:O16)</f>', '<f>SUBTOTAL(9,O11:O16)</f>')
    expect(() =>
      writeActuals(broken, [{ sheet: 'RKB TOILET ', rowNumber: 12, day: 6, value: 1 }]),
    ).toThrowError(/not a SUM range|cannot refresh/i)
  })

  it('throws when the percentage formula is not the shape it caches', () => {
    const broken = doctor(original, '<f>N18/N17*100%</f>', '<f>N18/D17*100%</f>')
    expect(() =>
      writeActuals(broken, [{ sheet: 'RKB TOILET ', rowNumber: 12, day: 6, value: 1 }]),
    ).toThrowError(/expected .*N18\/N17/)
  })

  it('does not corrupt a cell that already carries another type attribute', () => {
    const typed = doctor(original, '<c r="J19" s="111" t="e">', '<c r="J19" s="111" t="str">')
    const out = writeActuals(typed, [
      { sheet: 'RKB TOILET ', rowNumber: 12, day: 4, value: 1 },
    ]).bytes
    const xml = strFromU8(unzipSync(out)[TOILET] as Uint8Array)
    const tag = /<c [^>]*r="J19"[^>]*>/.exec(xml)?.[0] ?? ''
    expect((tag.match(/\st="/g) ?? []).length).toBe(1)
    expect(tag).toContain('t="e"')
  })
})

describe('AC-7 · a SUM spanning more than one column sums all of them', () => {
  /**
   * Reno's file only uses single-column SUMs, so this doctors one into the
   * two-column form. Summing just the first column would under-report and
   * leave no trace, which is why the range is walked rather than assumed.
   */
  const edit = { sheet: 'RKB TOILET ', rowNumber: 12, day: 6, value: 1 } as const

  it('sums both columns, not just the first', () => {
    const singleColumn = Number(cellOf(writeActuals(original, [edit]).bytes, TOILET, 'N18').cached)

    const widened = doctor(original, '<f>SUM(O11:O16)</f>', '<f>SUM(N11:O16)</f>')
    const bothColumns = Number(cellOf(writeActuals(widened, [edit]).bytes, TOILET, 'N18').cached)

    expect(singleColumn).toBe(1)
    expect(bothColumns).toBe(2)
  })
})

describe('AC-7 · a total Reno typed as a literal is left alone, not refused', () => {
  /**
   * Ruang Utility rows 41/42 hold literal values for days 1 and 2 rather than
   * formulas. There is no range to tell the writer what to sum, so the literal
   * is authoritative. Refusing the write would be worse than a stale total:
   * the A value would never land, and one such cell would take a whole
   * month's export with it.
   */
  const edit = { sheet: 'RKB RUANG UTILITY', rowNumber: 12, day: 1, value: 1 } as const

  it('still writes the A value', () => {
    const result = writeActuals(original, [edit])
    const row = parseWorkbook(result.bytes)
      .sheets.find((s) => s.name === 'RKB RUANG UTILITY')
      ?.sections.flatMap((x) => x.rows)
      .find((r) => r.rowNumber === 12)
    expect(row?.days[0]?.actual).toBe(1)
  })

  it('reports the total it could not refresh', () => {
    expect(writeActuals(original, [edit]).staleTotals).toEqual([
      {
        sheet: 'RKB RUANG UTILITY',
        column: 'F',
        row: 41,
        reason: 'the workbook states this total as a literal, not a formula',
      },
      {
        sheet: 'RKB RUANG UTILITY',
        column: 'F',
        row: 42,
        reason: 'the workbook states this total as a literal, not a formula',
      },
    ])
  })

  it('does not take the rest of the batch down with it', () => {
    const result = writeActuals(original, [
      edit,
      { sheet: 'RKB TOILET ', rowNumber: 12, day: 6, value: 1 },
    ])
    expect(cellOf(result.bytes, TOILET, 'N18').cached).toBe('1')
  })

  it('reports nothing stale for a sheet whose totals are all formulas', () => {
    const result = writeActuals(original, [
      { sheet: 'RKB TOILET ', rowNumber: 12, day: 6, value: 1 },
    ])
    expect(result.staleTotals).toEqual([])
  })
})

describe('AC-5 · a self-closing cell gains exactly one value', () => {
  it('does not emit two <v> children, which Excel offers to repair', () => {
    // N21 on Toilet is a self-closing totals cell in section 2.
    const out = writeActuals(original, [
      { sheet: 'RKB TOILET ', rowNumber: 26, day: 6, value: 1 },
    ]).bytes
    const xml = strFromU8(unzipSync(out)[TOILET] as Uint8Array)
    for (const ref of ['N31', 'N32', 'N33']) {
      const tag = new RegExp(`<c [^>]*r="${ref}"[^>]*?>.*?</c>`).exec(xml)?.[0] ?? ''
      expect((tag.match(/<v>/g) ?? []).length, `${ref} value count`).toBeLessThanOrEqual(1)
    }
  })
})
