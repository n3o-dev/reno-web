import { describe, expect, it } from 'vitest'
import { loadFixtureSource } from '@/contract/source'
import { causeSplit, repeatAreas, WITHIN_RENO_CONTROL } from '@/rules/causes'

const source = await loadFixtureSource()

describe('the cause split', () => {
  const split = causeSplit(source.complaints)

  it('counts every complaint exactly once', () => {
    expect(split.total).toBe(75)
    expect(split.withinRenoControl + split.outsideRenoControl).toBe(split.total)
    expect(split.items.reduce((n, i) => n + i.count, 0)).toBe(split.total)
  })

  it('puts only hk_standard within Reno control', () => {
    expect(WITHIN_RENO_CONTROL).toEqual(['hk_standard'])
    const outside = split.items.filter((i) => !i.withinRenoControl).map((i) => i.cause)
    expect(outside).toEqual([
      'tenant_project_event',
      'engineering_equipment',
      'spill',
      'external_other',
    ])
  })

  it('itemises every cause, including the ones at zero', () => {
    expect(split.items).toHaveLength(5)
  })

  it('keeps the closed set order rather than sorting by size', () => {
    expect(split.items.map((i) => i.cause)).toEqual([
      'hk_standard',
      'tenant_project_event',
      'engineering_equipment',
      'spill',
      'external_other',
    ])
  })
})

describe('repeat areas', () => {
  const repeats = repeatAreas(source.complaints)

  it('finds the seven the deck shows', () => {
    expect(repeats).toHaveLength(7)
  })

  it('puts the worst first, and breaks a tie by name rather than by luck', () => {
    // Two areas recur on three days each: the bins outside CMO and the
    // Toilet LT2 the deck singles out.
    expect(repeats.slice(0, 2).map((r) => r.areaId)).toEqual([
      'tempat_sampah_cmo',
      'toilet_lt2',
    ])
    expect(repeats.slice(0, 2).map((r) => r.days.length)).toEqual([3, 3])
    expect(repeats.at(-1)?.days).toHaveLength(2)
  })

  it('counts days, not complaints: twice in one day is not a repeat', () => {
    const once = source.complaints.filter((c) => c.area_id === 'toilet_lt2').slice(0, 2)
    const sameDay = once.map((c) => ({ ...c, raised_at: '2026-09-10T08:00:00+07:00' }))
    expect(repeatAreas(sameDay)).toEqual([])
  })

  it('ignores complaints that named no area', () => {
    const unnamed = source.complaints
      .filter((c) => c.area_id === null)
      .map((c) => ({ ...c, raised_at: '2026-09-1?' }))
    expect(repeatAreas(unnamed)).toEqual([])
  })
})
