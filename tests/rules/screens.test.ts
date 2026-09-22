import { describe, expect, it } from 'vitest'
import { loadFixtureSource } from '@/contract/source'
import { scoreReporters } from '@/rules/reporters'
import { complaintHeatmap, escalation } from '@/rules/heatmap'
import { unreportedAreas } from '@/rules/unreported-areas'
import { areaLabeller, zoneLookup } from '@/rules/area'

const source = await loadFixtureSource()
const DAYS = ['2026-09-10', '2026-09-11', '2026-09-12', '2026-09-13']

describe('the per-reporter scorecard', () => {
  const scores = scoreReporters(source.workReports)

  it('covers every reporter and no one else', () => {
    expect(scores).toHaveLength(new Set(source.workReports.map((r) => r.sender_raw)).size)
    expect(scores.reduce((n, s) => n + s.reports, 0)).toBe(source.workReports.length)
  })

  it('puts the worst pass rate first, because that is the row worth finding', () => {
    const rates = scores.map((s) => s.passRate)
    expect([...rates].sort((a, b) => a - b)).toEqual(rates)
  })

  it('counts clean reports, not defect-free people', () => {
    for (const score of scores) {
      expect(score.clean).toBeLessThanOrEqual(score.reports)
      expect(score.passRate).toBeCloseTo(score.clean / score.reports)
    }
  })
})

describe('the area-by-day heatmap', () => {
  const heatmap = complaintHeatmap(source.complaints, DAYS)

  it('counts every complaint that named a day in range', () => {
    const inRange = source.complaints.filter((c) => DAYS.includes(c.raised_at.slice(0, 10)))
    const counted = heatmap.rows.reduce((n, row) => n + row.total, 0)
    // Only the busiest rows are shown, so the counted total is a subset.
    expect(counted).toBeGreaterThan(0)
    expect(counted).toBeLessThanOrEqual(inRange.length)
  })

  it('puts the busiest area first', () => {
    const totals = heatmap.rows.map((r) => r.total)
    expect([...totals].sort((a, b) => b - a)).toEqual(totals)
  })

  it('never reports a peak below one, so the ramp cannot divide by zero', () => {
    expect(complaintHeatmap([], DAYS).peak).toBe(1)
  })
})

describe('the escalation ladder', () => {
  it.each([
    [1, 'noticed'],
    [2, 'repeat'],
    [3, 'escalating'],
    [9, 'escalating'],
  ] as const)('%i days → %s', (days, step) => {
    expect(escalation(days)).toBe(step)
  })
})

describe('areas nobody reported work in', () => {
  const zones = zoneLookup(source.areas)

  it('reports nothing while no area carries a zone', () => {
    /*
     * Every area in the master has `zone: null`, because nothing in the
     * sources says which place sits in which zone. With no zone to credit a
     * report to, the honest answer is no answer — not 64 false alarms.
     */
    expect(zones.size).toBe(0)
    const result = unreportedAreas(source.lineups, source.workReports, zones)
    expect(result.areas).toEqual([])
    expect(result.unplaceable).toBeGreaterThan(0)
  })

  it('finds a genuinely quiet area once zones are known', () => {
    const known = new Map(
      source.workReports
        .map((r) => r.area_id)
        .filter((a): a is string => a !== null)
        .map((a) => [a, 'gf'] as const),
    )
    const result = unreportedAreas(source.lineups, source.workReports, known)
    expect(result.unplaceable).toBe(0)
    // Everything mapped to `gf`, so every other rostered zone is quiet.
    expect(result.areas.length).toBeGreaterThan(0)
    expect(result.areas.every((a) => a.areaId !== 'gf')).toBe(true)
    expect(result.areas[0]?.rostered.length).toBeGreaterThan(0)
  })
})

describe('the area master', () => {
  it('gives a place the label a person wrote, not an un-slugged id', () => {
    const label = areaLabeller(source.areas)
    expect(label('toilet_lt2')).toBe('Toilet LT2 dekat Rockstar')
    expect(label('area_apong')).toBe('Area APONG')
  })

  it('falls back to un-slugging an id the master does not know', () => {
    expect(areaLabeller([])('carpark_p1_zona_a')).toBe('Carpark P1 Zona A')
  })

  it('says nothing when the complaint named no area', () => {
    expect(areaLabeller(source.areas)(null)).toBeNull()
  })
})
