import { describe, expect, it } from 'vitest'
import Ajv2020 from 'ajv/dist/2020.js'
import addFormats from 'ajv-formats'
import { JSON_SCHEMAS, RECORD_TYPES, type Defect } from '@/contract/schemas'
import { loadFixtureSource } from '@/contract/source'

/**
 * The published Living World Alam Sutera figures, 10–13 September 2026.
 * Source: the Reno AI case-study deck. If a fixture change breaks one of
 * these, the fixture is wrong — not the number.
 */
const DAYS = ['2026-09-10', '2026-09-11', '2026-09-12', '2026-09-13'] as const

const ajv = addFormats(new Ajv2020({ strict: true, allErrors: true }))
const source = await loadFixtureSource()

const perDay = <T extends { date?: string; sent_at: string }>(records: readonly T[]): number[] =>
  DAYS.map((d) => records.filter((r) => r.sent_at.startsWith(d)).length)

describe('every fixture validates against the emitted schema', () => {
  it.each(RECORD_TYPES)('%s', (type) => {
    const validate = ajv.compile(JSON_SCHEMAS[type])
    const bad = source.all(type).filter((r) => !validate(r))
    expect(bad.slice(0, 3)).toEqual([])
  })
})

describe('AC-5 · per-day totals match the deck', () => {
  it('messages 339, 414, 326, 299', () => {
    expect(perDay(source.messages)).toEqual([339, 414, 326, 299])
  })
  it('work reports 166, 149, 170, 154', () => {
    expect(perDay(source.workReports)).toEqual([166, 149, 170, 154])
  })
  it('complaints 19, 35, 4, 17', () => {
    expect(perDay(source.complaints)).toEqual([19, 35, 4, 17])
  })
  it('closed with photo 9, 10, 3, 7', () => {
    const closed = source.complaints.filter((c) => c.state === 'closed_with_photo')
    expect(perDay(closed)).toEqual([9, 10, 3, 7])
  })
})

describe('AC-4 · period totals match the deck', () => {
  it('1378 messages', () => {
    expect(source.messages).toHaveLength(1378)
  })
  it('1052 photos', () => {
    expect(source.photos).toHaveLength(1052)
  })
  it('639 work reports, 578 passing validation', () => {
    expect(source.workReports).toHaveLength(639)
    expect(source.workReports.filter((r) => r.defects.length === 0)).toHaveLength(578)
  })
  it('61 reports carry before and after', () => {
    expect(source.workReports.filter((r) => r.is_before_after)).toHaveLength(61)
  })
  it('75 complaints, 62 answered, 29 closed with a photo', () => {
    expect(source.complaints).toHaveLength(75)
    const answered = source.complaints.filter((c) => c.state !== 'raised')
    expect(answered).toHaveLength(62)
    expect(source.complaints.filter((c) => c.state === 'closed_with_photo')).toHaveLength(29)
  })
  it('3 duplicate photo pairs, detectable by perceptual hash alone', () => {
    const seen = new Map<string, number>()
    for (const p of source.photos) seen.set(p.perceptual_hash, (seen.get(p.perceptual_hash) ?? 0) + 1)
    const duplicated = [...seen.values()].filter((n) => n > 1)
    expect(duplicated).toHaveLength(3)
    expect(duplicated.every((n) => n === 2)).toBe(true)
  })
  it('25 photos arrived over three hours after capture', () => {
    const late = source.photos.filter((p) => {
      if (p.captured_at === null) return false
      const gap = Date.parse(p.received_at) - Date.parse(p.captured_at)
      return gap > 3 * 60 * 60 * 1000
    })
    expect(late).toHaveLength(25)
  })
  it('7 areas were complained about on more than one day', () => {
    const days = new Map<string, Set<string>>()
    for (const c of source.complaints) {
      if (c.area_id === null) continue
      const set = days.get(c.area_id) ?? new Set<string>()
      set.add(c.raised_at.slice(0, 10))
      days.set(c.area_id, set)
    }
    const repeats = [...days.values()].filter((d) => d.size > 1)
    expect(repeats).toHaveLength(7)
  })
})

describe('AC-4 · defect breakdown matches the deck', () => {
  const countOf = (defect: Defect): number[] =>
    DAYS.map(
      (d) =>
        source.workReports.filter((r) => r.sent_at.startsWith(d) && r.defects.includes(defect))
          .length,
    )

  it('no area 7, 12, 9, 8', () => expect(countOf('no_area')).toEqual([7, 12, 9, 8]))
  it('done without complaint 5, 3, 2, 2', () =>
    expect(countOf('done_without_complaint')).toEqual([5, 3, 2, 2]))
  it('no caption 5, 4, 0, 1', () => expect(countOf('no_caption')).toEqual([5, 4, 0, 1]))
  it('photo reused 3, 0, 0, 0', () => expect(countOf('photo_reused')).toEqual([3, 0, 0, 0]))
})
