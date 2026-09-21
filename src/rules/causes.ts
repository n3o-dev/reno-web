import { CAUSES, type Cause, type ComplaintRecord } from '@/contract/schemas'

/**
 * The cause split the client sees.
 *
 * Within Reno's control is `hk_standard` alone; everything else is outside
 * it, and every cause is still itemised underneath. The split exists so a
 * month with a tenant fit-out running does not read as Reno slipping — and
 * the itemisation exists so the split cannot be used to hide behind.
 *
 * Reno-facing figures use the gross count including every cause. No Reno
 * screen shows a filtered total as its headline.
 *
 * See docs/specs/billing-and-scoring-rules.md
 */
export const WITHIN_RENO_CONTROL: readonly Cause[] = ['hk_standard']

export interface CauseCount {
  readonly cause: Cause
  readonly count: number
  readonly withinRenoControl: boolean
}

export interface CauseSplit {
  readonly total: number
  readonly withinRenoControl: number
  readonly outsideRenoControl: number
  /** In the closed set's own order, so the chart never reorders itself. */
  readonly items: readonly CauseCount[]
}

export function causeSplit(complaints: readonly ComplaintRecord[]): CauseSplit {
  const items = CAUSES.map((cause) => ({
    cause,
    count: complaints.filter((c) => c.cause === cause).length,
    withinRenoControl: WITHIN_RENO_CONTROL.includes(cause),
  }))

  return {
    total: complaints.length,
    withinRenoControl: items
      .filter((i) => i.withinRenoControl)
      .reduce((n, i) => n + i.count, 0),
    outsideRenoControl: items
      .filter((i) => !i.withinRenoControl)
      .reduce((n, i) => n + i.count, 0),
    items,
  }
}

export interface RepeatArea {
  readonly areaId: string
  readonly days: readonly string[]
}

/**
 * Areas complained about on more than one day.
 *
 * The escalation ladder in one figure: a Toilet LT2 that recurs on three
 * days is a different problem from three unrelated complaints, and the
 * difference is invisible in a total.
 */
export function repeatAreas(complaints: readonly ComplaintRecord[]): readonly RepeatArea[] {
  const daysByArea = new Map<string, Set<string>>()
  for (const complaint of complaints) {
    if (complaint.area_id === null) continue
    const days = daysByArea.get(complaint.area_id) ?? new Set<string>()
    days.add(complaint.raised_at.slice(0, 10))
    daysByArea.set(complaint.area_id, days)
  }

  return [...daysByArea.entries()]
    .filter(([, days]) => days.size > 1)
    .map(([areaId, days]) => ({ areaId, days: [...days].sort() }))
    .sort((a, b) => b.days.length - a.days.length || a.areaId.localeCompare(b.areaId))
}
