import { describe, expect, it } from 'vitest'
import { loadFixtureSource } from '@/contract/source'
import type { LineupRecord } from '@/contract/schemas'
import {
  absenceTotals,
  coverage,
  doubleListings,
  headcountMismatches,
  provisionalContracts,
  slotDays,
} from '@/rules/manpower'

const source = await loadFixtureSource()
const lineups = source.lineups
const first = lineups[0]
if (first === undefined) throw new Error('fixture set has no line-ups')

describe('the line-up becomes slot-days', () => {
  it('splits each line-up into one slot-day per area', () => {
    const days = slotDays([first])
    expect(days.map((d) => d.slot_id)).toEqual([
      'external:1',
      'garbage:1',
      'gf:1',
      'gondola:1',
      'lk:1',
      'lt1:1',
      'lt2:1',
      'ug:1',
    ])
    expect(days.reduce((n, d) => n + d.names.length, 0)).toBe(first.entries.length)
  })

  it('carries the line-up message through, so every slot-day cites its source', () => {
    for (const day of slotDays(lineups)) {
      expect(day.source_message_id).not.toBe('')
    }
  })

  it('attributes a shift absence once, not once per area', () => {
    const withAbsence: LineupRecord = { ...first, sakit: 2 }
    const counted = slotDays([withAbsence]).flatMap((d) => d.absences)
    expect(counted).toEqual([{ reason: 'sakit', count: 2 }])
  })
})

describe('provisional contracts', () => {
  it('take the fullest roster seen for each area and shift', () => {
    const contracts = provisionalContracts(lineups)
    expect(contracts.find((c) => c.slot_id === 'gf:1')?.contracted).toBe(8)
    expect(contracts.find((c) => c.slot_id === 'garbage:2')?.contracted).toBe(1)
    expect(contracts).toHaveLength(16) // eight areas across two shifts
  })

  it('cannot show a shortfall, which is why the screen calls them provisional', () => {
    const contracts = provisionalContracts(lineups)
    for (const area of coverage(contracts, slotDays(lineups))) {
      expect(area.filled).toBe(area.contractedSlotDays)
    }
  })
})

describe('signals for a human to check', () => {
  it('finds nobody listed in two areas in this period', () => {
    expect(doubleListings(lineups)).toEqual([])
  })

  it('finds a name listed twice when there is one', () => {
    const entry = first.entries[0]
    if (entry === undefined) throw new Error('line-up has no entries')
    const doubled: LineupRecord = {
      ...first,
      entries: [...first.entries, { ...entry, area_id: 'lt2' }],
      total_mp: first.entries.length + 1,
    }
    expect(doubleListings([doubled])).toEqual([
      { name: entry.name_raw, date: first.date, shift: first.shift, areas: [entry.area_id, 'lt2'] },
    ])
  })

  it('flags a stated headcount that disagrees with the names listed', () => {
    expect(headcountMismatches(lineups)).toEqual([])
    const wrong: LineupRecord = { ...first, total_mp: first.entries.length + 3 }
    expect(headcountMismatches([wrong])[0]).toMatchObject({
      stated: first.entries.length + 3,
      listed: first.entries.length,
    })
  })
})

describe('absences', () => {
  it('are all zero in this period, because the group reported none', () => {
    expect(absenceTotals(lineups)).toEqual({ off_day: 0, sakit: 0, izin: 0, alfa: 0 })
  })

  it('sum across the period when they are reported', () => {
    expect(absenceTotals([{ ...first, sakit: 2 }, { ...first, sakit: 1, alfa: 4 }])).toEqual({
      off_day: 0,
      sakit: 3,
      izin: 0,
      alfa: 4,
    })
  })
})
