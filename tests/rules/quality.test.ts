import { describe, expect, it } from 'vitest'
import { loadFixtureSource } from '@/contract/source'
import {
  countBeforeAfter,
  countDefects,
  countLatePhotos,
  findDuplicatePhotos,
  validationPassRate,
} from '@/rules/quality'

/**
 * The deck's Report Quality page, recomputed from the records.
 *
 * The numbers are written out here rather than imported from
 * published-figures.ts: a test that imports the value it checks only proves
 * the generator agrees with itself.
 */
const source = await loadFixtureSource()

describe('the defect breakdown matches the deck', () => {
  const counts = new Map(countDefects(source.workReports).map((d) => [d.defect, d.count]))

  it.each([
    ['no_area', 36],
    ['done_without_complaint', 12],
    ['no_caption', 10],
    ['photo_reused', 3],
  ] as const)('%s = %i', (defect, expected) => {
    expect(counts.get(defect)).toBe(expected)
  })

  it('reports the closed set in its own order, including the unused defects', () => {
    expect(countDefects(source.workReports).map((d) => d.defect)).toEqual([
      'no_area',
      'no_caption',
      'done_without_complaint',
      'photo_reused',
      'photo_late_1h',
      'photo_late_3h',
      'photo_before_complaint',
    ])
  })
})

describe('evidence coverage matches the deck', () => {
  it('61 reports carry before and after', () => {
    expect(countBeforeAfter(source.workReports)).toBe(61)
  })

  it('25 photos arrived more than three hours after capture', () => {
    expect(countLatePhotos(source.photos)).toBe(25)
  })

  it('3 pairs of photos share a hash', () => {
    expect(findDuplicatePhotos(source.photos)).toHaveLength(3)
  })
})

describe('countLatePhotos is honest about what it does not know', () => {
  const [first] = source.photos
  if (first === undefined) throw new Error('fixture set has no photos')

  it('does not count a photo whose capture time is missing', () => {
    const unknown = { ...first, captured_at: null }
    expect(countLatePhotos([unknown])).toBe(0)
  })

  it('counts a gap over the threshold and not one under it', () => {
    const late = { ...first, captured_at: '2026-09-10T06:00:00+07:00', received_at: '2026-09-10T09:01:00+07:00' }
    const onTime = { ...first, captured_at: '2026-09-10T06:00:00+07:00', received_at: '2026-09-10T08:59:00+07:00' }
    expect(countLatePhotos([late])).toBe(1)
    expect(countLatePhotos([onTime])).toBe(0)
  })
})

describe('the pass rate counts only clean reports', () => {
  it('agrees with the defect counts', () => {
    const withDefects = source.workReports.filter((r) => r.defects.length > 0).length
    const rate = validationPassRate(source.workReports)
    expect(rate).toBeCloseTo((source.workReports.length - withDefects) / source.workReports.length)
    // 639 reports, 61 of them carrying at least one defect.
    expect(withDefects).toBe(61)
  })
})
