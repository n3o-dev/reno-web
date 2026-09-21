import { describe, expect, it } from 'vitest'
import { readFile } from 'node:fs/promises'
import { unzipSync, strFromU8 } from 'fflate'
import { parseWorkbook } from '@/rkb/read'
import { writeActuals } from '@/rkb/write'

const original = new Uint8Array(await readFile('fixtures/rkb/RKB_JULI_2026.xlsx'))
const FACADE = 'xl/worksheets/sheet4.xml'

/**
 * Facade row 12, day 5: planned, not realised, and in the real period it was
 * held up because the car gondola never arrived — the case AC-8 exists for.
 */
const blockedEdit = {
  sheet: 'RKB FACADE',
  rowNumber: 12,
  day: 5,
  value: 0,
  blocked: {
    reason: 'car gondola not on site',
    source_message_id: 'msg_20260911_1138_412',
  },
} as const

describe('AC-8 · a blocked row writes 0 and nothing else', () => {
  const result = writeActuals(original, [blockedEdit])

  it('writes a plain 0 into the A cell', () => {
    const row = parseWorkbook(result.bytes)
      .sheets.find((s) => s.name === 'RKB FACADE')
      ?.sections.flatMap((x) => x.rows)
      .find((r) => r.rowNumber === 12)
    expect(row?.days[4]?.actual).toBe(0)
  })

  it('invents no marker in the workbook — no comment, no note, no flag', () => {
    const before = strFromU8(unzipSync(original)[FACADE] as Uint8Array)
    const after = strFromU8(unzipSync(result.bytes)[FACADE] as Uint8Array)
    for (const marker of ['blocked', 'BLOCKED', 'msg_2026', 'gondola', '<comment', 'legacyDrawing']) {
      expect(after.includes(marker), `${marker} must not appear`).toBe(before.includes(marker))
    }
  })

  it('adds no new zip entry — a comment part would be one', () => {
    expect(Object.keys(unzipSync(result.bytes)).sort()).toEqual(
      Object.keys(unzipSync(original)).sort(),
    )
  })

  it('returns the block and its citation alongside the file, not inside it', () => {
    expect(result.blocked).toEqual([
      {
        sheet: 'RKB FACADE',
        rowNumber: 12,
        day: 5,
        ref: 'O12',
        reason: 'car gondola not on site',
        source_message_id: 'msg_20260911_1138_412',
      },
    ])
  })

  it('counts a blocked day as not realised in the totals', () => {
    // A 0 must behave as "not done", never quietly inflate REALISASI.
    const cached = (bytes: Uint8Array, ref: string): string | null => {
      const xml = strFromU8(unzipSync(bytes)[FACADE] as Uint8Array)
      const tag = new RegExp(`<c [^>]*r="${ref}"[^>]*?>.*?</c>`).exec(xml)?.[0] ?? ''
      return /<v>(.*?)<\/v>/.exec(tag)?.[1] ?? null
    }
    expect(cached(result.bytes, 'N20')).toBe(cached(original, 'N20'))
  })
})

describe('AC-8 · a block is invalid without a citation', () => {
  it('refuses a blocked edit with no source message', () => {
    expect(() =>
      writeActuals(original, [
        {
          ...blockedEdit,
          blocked: { reason: 'car gondola not on site', source_message_id: '   ' },
        },
      ]),
    ).toThrowError(/citation|source message/i)
  })

  it('refuses a blocked edit with no reason', () => {
    expect(() =>
      writeActuals(original, [
        { ...blockedEdit, blocked: { reason: '', source_message_id: 'msg_1' } },
      ]),
    ).toThrowError(/reason/i)
  })

  it('refuses a blocked edit that tries to write anything but 0', () => {
    expect(() => writeActuals(original, [{ ...blockedEdit, value: 1 }])).toThrowError(
      /blocked.*0/i,
    )
  })
})

describe('AC-8 · an ordinary edit reports no blocks', () => {
  it('returns an empty list', () => {
    const result = writeActuals(original, [
      { sheet: 'RKB TOILET ', rowNumber: 12, day: 6, value: 1 },
    ])
    expect(result.blocked).toEqual([])
  })
})
