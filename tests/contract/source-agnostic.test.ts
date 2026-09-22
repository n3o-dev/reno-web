import { describe, expect, it } from 'vitest'
import { loadFixtureSource } from '@/contract/source'
import { closureStats } from '@/rules/clock'
import { RECORD_TYPES } from '@/contract/schemas'
import { createPagedRecordSource, paginate } from '../support/paged-source'

/**
 * AC-6: downstream code must not be able to tell which implementation it holds.
 *
 * The second source is a paged implementation that shares no code with the
 * fixture loader — comparing a factory against itself would prove nothing.
 * Record counts are asserted explicitly so an implementation that silently
 * drops records cannot pass by agreeing with itself.
 */
const fromDisk = await loadFixtureSource()

const paged = createPagedRecordSource({
  area: paginate(fromDisk.areas, 9),
  message: paginate(fromDisk.messages, 100),
  work_report: paginate(fromDisk.workReports, 64),
  complaint: paginate(fromDisk.complaints, 7),
  work_order: paginate(fromDisk.workOrders, 2),
  lineup: paginate(fromDisk.lineups, 5),
  rkb_match: paginate(fromDisk.rkbMatches, 1),
  rkb_block: paginate(fromDisk.rkbBlocks, 1),
  photo: paginate(fromDisk.photos, 250),
  person: paginate(fromDisk.people, 3),
})

/** The published totals. Pinned so neither source can quietly lose records. */
const EXPECTED: Record<string, number> = {
  message: 1378,
  work_report: 639,
  complaint: 75,
  work_order: 4,
  lineup: 60,
  rkb_match: 1,
  rkb_block: 1,
  photo: 1052,
  person: 45,
  area: 66,
}

describe('the rules layer cannot tell which source it is holding', () => {
  it.each(RECORD_TYPES)('serves the full set of %s records from both', (type) => {
    expect(fromDisk.all(type)).toHaveLength(EXPECTED[type] as number)
    expect(paged.all(type)).toHaveLength(EXPECTED[type] as number)
    expect(paged.all(type)).toEqual(fromDisk.all(type))
  })

  it('produces identical complaint statistics through both', () => {
    const viaDisk = closureStats(fromDisk.complaints)
    const viaPaged = closureStats(paged.complaints)
    expect(viaPaged).toEqual(viaDisk)
    // Guard against both sides being trivially empty.
    expect(viaDisk.raised).toBe(75)
  })

  it('is stable across repeated reads, so a cold and a warm cache agree', () => {
    // A fresh source reads cold; `paged` above has already materialised.
    const cold = createPagedRecordSource({
      message: paginate(fromDisk.messages, 37),
      work_report: paginate(fromDisk.workReports, 11),
      complaint: paginate(fromDisk.complaints, 3),
      work_order: paginate(fromDisk.workOrders, 1),
      lineup: paginate(fromDisk.lineups, 4),
      rkb_match: paginate(fromDisk.rkbMatches, 1),
      rkb_block: paginate(fromDisk.rkbBlocks, 1),
      photo: paginate(fromDisk.photos, 13),
      person: paginate(fromDisk.people, 2),
      area: paginate(fromDisk.areas, 2),
    })
    expect(cold.all('photo')).toHaveLength(1052)
    expect(cold.complaints).toEqual(paged.complaints)
  })
})

describe('the fixture loader is defensive at its boundary', () => {
  it('rejects a directory whose records do not match the schema', async () => {
    await expect(loadFixtureSource('tests/support/bad-fixtures')).rejects.toThrow(
      /does not match the .* schema/,
    )
  })
})
