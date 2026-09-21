import { describe, expect, it } from 'vitest'
import { createRecordSource, loadFixtureSource, type RecordSource } from '@/contract/source'
import { closureStats } from '@/rules/clock'
import { RECORD_TYPES } from '@/contract/schemas'

/**
 * AC-6: downstream code must not be able to tell which implementation it
 * holds. Proved by running the same computation through two different
 * RecordSource implementations and requiring identical output.
 */
const fromDisk = await loadFixtureSource()

const inMemory: RecordSource = createRecordSource({
  message: [...fromDisk.messages],
  work_report: [...fromDisk.workReports],
  complaint: [...fromDisk.complaints],
  work_order: [...fromDisk.workOrders],
  lineup: [...fromDisk.lineups],
  rkb_match: [...fromDisk.rkbMatches],
  photo: [...fromDisk.photos],
  person: [...fromDisk.people],
})

describe('the rules layer cannot tell which source it is holding', () => {
  it('produces identical complaint statistics through both', () => {
    expect(closureStats(inMemory.complaints)).toEqual(closureStats(fromDisk.complaints))
  })

  it.each(RECORD_TYPES)('exposes the same %s records through all()', (type) => {
    expect(inMemory.all(type)).toEqual(fromDisk.all(type))
  })
})

describe('the fixture loader is defensive at its boundary', () => {
  it('rejects a directory whose records do not match the schema', async () => {
    await expect(loadFixtureSource('tests/support/bad-fixtures')).rejects.toThrow(
      /does not match the .* schema/,
    )
  })
})
