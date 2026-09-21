import { describe, expect, it } from 'vitest'
import { readFile } from 'node:fs/promises'
import { unzipSync, zipSync, strFromU8, strToU8 } from 'fflate'
import { writeActuals } from '@/rkb/write'

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
