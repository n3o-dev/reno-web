import type { LineupRecord, WorkReportRecord } from '@/contract/schemas'

/**
 * Areas somebody was rostered to and nobody reported work in.
 *
 * The spec asks for "names in the Line-up that appear in no report all
 * shift". Taken literally that is not computable and never will be: a
 * cleaner does not file reports — the team leader does, under their own
 * name — so comparing roster names against report authors would flag all
 * 37 people every shift and teach everyone to ignore the panel.
 *
 * What is computable is the thing the signal was for: an area with people
 * assigned and no work reported in it for a whole shift. That is a real
 * question for a person to ask, and it names who was rostered there
 * without accusing them of anything.
 *
 * See docs/specs/reno-dashboard.md (screen 5).
 */
export interface UnreportedArea {
  readonly date: string
  readonly shift: number
  readonly areaId: string
  readonly rostered: readonly string[]
}

export interface UnreportedResult {
  readonly areas: readonly UnreportedArea[]
  /**
   * Places the reports named whose zone nobody has stated. While this is
   * non-zero the answer is incomplete, and the panel says so rather than
   * reporting a zone as unreported when a report for it simply could not
   * be placed.
   */
  readonly unplaceable: number
}

export function unreportedAreas(
  lineups: readonly LineupRecord[],
  reports: readonly WorkReportRecord[],
  zoneOf: ReadonlyMap<string, string>,
): UnreportedResult {
  const reportedByDayShift = new Map<string, Set<string>>()
  let unplaceable = 0
  for (const report of reports) {
    if (report.area_id === null) continue
    const zone = zoneOf.get(report.area_id)
    // A report naming a place whose zone nobody has stated cannot be
    // credited to a zone. Counting it as coverage would hide a gap;
    // ignoring it silently would invent one.
    if (zone === undefined) {
      unplaceable += 1
      continue
    }
    const key = `${report.sent_at.slice(0, 10)}|${report.shift}`
    const areas = reportedByDayShift.get(key) ?? new Set<string>()
    areas.add(zone)
    reportedByDayShift.set(key, areas)
  }

  const out: UnreportedArea[] = []
  for (const lineup of lineups) {
    const reported = reportedByDayShift.get(`${lineup.date}|${lineup.shift}`)
    /*
     * A shift with no reports at all is one problem, not one per area.
     * Listing every rostered area for a day nobody reported buries the
     * signal this exists to surface — an area that went quiet while the
     * rest of the site was reporting normally.
     */
    if (reported === undefined || reported.size === 0) continue
    const rosteredByArea = new Map<string, string[]>()
    for (const entry of lineup.entries) {
      const names = rosteredByArea.get(entry.area_id) ?? []
      names.push(entry.name_raw)
      rosteredByArea.set(entry.area_id, names)
    }
    for (const [areaId, rostered] of rosteredByArea) {
      if (reported.has(areaId)) continue
      out.push({ date: lineup.date, shift: lineup.shift, areaId, rostered })
    }
  }

  return {
    areas: out.sort(
      (a, b) =>
        a.date.localeCompare(b.date) || a.shift - b.shift || a.areaId.localeCompare(b.areaId),
    ),
    unplaceable,
  }
}
