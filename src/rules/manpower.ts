import type { LineupRecord } from '@/contract/schemas'
import type { SlotContract, SlotDay } from '@/rules/billing'
import { ABSENCE_REASONS, type AbsenceReason } from '@/rules/billing'

/**
 * Turns the group's line-up messages into the slot shape billing works in.
 *
 * The Line-up is the only attendance record Reno has, and it is a claim: the
 * project leader typing names into WhatsApp. Nothing here upgrades it to an
 * observation — the screens label it `claimed` until an admin confirms it.
 *
 * See docs/specs/billing-and-scoring-rules.md and reno-dashboard.md (screen 5).
 */

export const slotId = (areaId: string, shift: number): string => `${areaId}:${shift}`

export interface AreaShiftDay {
  readonly slot_id: string
  readonly area_id: string
  readonly shift: number
  readonly date: string
  readonly names: readonly string[]
}

export function slotDays(lineups: readonly LineupRecord[]): readonly SlotDay[] {
  const out: SlotDay[] = []
  for (const lineup of lineups) {
    const byArea = new Map<string, string[]>()
    for (const entry of lineup.entries) {
      const names = byArea.get(entry.area_id) ?? []
      names.push(entry.name_raw)
      byArea.set(entry.area_id, names)
    }
    // Absences are reported per line-up, not per area, so they attach to the
    // shift's first area rather than being split across areas they were never
    // attributed to.
    const absences = ABSENCE_REASONS.map((reason) => ({
      reason,
      count: lineup[reason],
    })).filter((a) => a.count > 0)
    let first = true
    for (const [areaId, names] of [...byArea.entries()].sort(([a], [b]) => a.localeCompare(b))) {
      out.push({
        slot_id: slotId(areaId, lineup.shift),
        date: lineup.date,
        names,
        absences: first ? absences : [],
        source_message_id: lineup.source_message_id,
      })
      first = false
    }
  }
  return out
}

/**
 * Contracted headcount per area per shift, taken from the fullest roster the
 * period actually shows.
 *
 * Provisional, and labelled as such on the screen: the real figures live in
 * the service contract, which nothing has loaded yet. Derived this way the
 * coverage figure can only ever read as full, so it is not evidence of
 * anything — it is scaffolding until the contract arrives.
 */
export function provisionalContracts(lineups: readonly LineupRecord[]): readonly SlotContract[] {
  const peak = new Map<string, { area_id: string; shift: number; contracted: number }>()
  for (const day of slotDays(lineups)) {
    const [area_id = '', shiftText = '1'] = day.slot_id.split(':')
    const current = peak.get(day.slot_id)
    if (current === undefined || day.names.length > current.contracted) {
      peak.set(day.slot_id, {
        area_id,
        shift: Number(shiftText),
        contracted: day.names.length,
      })
    }
  }
  return [...peak.entries()]
    .map(([slot_id, v]) => ({ slot_id, area_id: v.area_id, shift: v.shift as 1 | 2 | 3, contracted: v.contracted }))
    .sort((a, b) => a.slot_id.localeCompare(b.slot_id))
}

export interface Coverage {
  readonly area_id: string
  readonly shift: number
  readonly contracted: number
  /** Filled slot-days summed over the period. */
  readonly filled: number
  readonly contractedSlotDays: number
}

export function coverage(
  contracts: readonly SlotContract[],
  days: readonly SlotDay[],
): readonly Coverage[] {
  const dayCount = new Set(days.map((d) => d.date)).size
  return contracts.map((contract) => ({
    area_id: contract.area_id,
    shift: contract.shift,
    contracted: contract.contracted,
    filled: days
      .filter((d) => d.slot_id === contract.slot_id)
      .reduce((sum, d) => sum + Math.min(d.names.length, contract.contracted), 0),
    contractedSlotDays: contract.contracted * dayCount,
  }))
}

export type AbsenceTotals = Readonly<Record<AbsenceReason, number>>

export function absenceTotals(lineups: readonly LineupRecord[]): AbsenceTotals {
  return {
    off_day: lineups.reduce((n, l) => n + l.off_day, 0),
    sakit: lineups.reduce((n, l) => n + l.sakit, 0),
    izin: lineups.reduce((n, l) => n + l.izin, 0),
    alfa: lineups.reduce((n, l) => n + l.alfa, 0),
  }
}

/**
 * A name listed in two different areas on the same shift. One of the two is
 * wrong, and neither the screen nor this function decides which — it is
 * surfaced as a signal for a person to check.
 */
export interface DoubleListing {
  readonly name: string
  readonly date: string
  readonly shift: number
  readonly areas: readonly string[]
}

export function doubleListings(lineups: readonly LineupRecord[]): readonly DoubleListing[] {
  const out: DoubleListing[] = []
  for (const lineup of lineups) {
    const areasByName = new Map<string, string[]>()
    for (const entry of lineup.entries) {
      const areas = areasByName.get(entry.name_raw) ?? []
      if (!areas.includes(entry.area_id)) areas.push(entry.area_id)
      areasByName.set(entry.name_raw, areas)
    }
    for (const [name, areas] of areasByName) {
      if (areas.length > 1) out.push({ name, date: lineup.date, shift: lineup.shift, areas })
    }
  }
  return out
}

/** A line-up whose stated headcount disagrees with the names it lists. */
export interface HeadcountMismatch {
  readonly date: string
  readonly shift: number
  readonly stated: number
  readonly listed: number
  readonly source_message_id: string
}

export function headcountMismatches(
  lineups: readonly LineupRecord[],
): readonly HeadcountMismatch[] {
  return lineups
    .filter((l) => l.total_mp !== l.entries.length)
    .map((l) => ({
      date: l.date,
      shift: l.shift,
      stated: l.total_mp,
      listed: l.entries.length,
      source_message_id: l.source_message_id,
    }))
}

export interface SlotDayCorrection {
  readonly slot_id: string
  readonly date: string
  readonly filled: number
}

/**
 * Applies a person's corrections to the claimed attendance.
 *
 * The line-up is what the project leader typed; a correction is what someone
 * checked. Applying it here rather than at render time is what makes every
 * figure downstream — coverage, the deduction, the amount payable — move
 * with it instead of only the number being looked at.
 *
 * Names are truncated rather than invented: correcting a slot down to two
 * keeps the first two the line-up listed, so the evidence still points at
 * people who were named.
 */
export function applySlotCorrections(
  days: readonly SlotDay[],
  corrections: readonly SlotDayCorrection[],
): readonly SlotDay[] {
  if (corrections.length === 0) return days
  const byKey = new Map(corrections.map((c) => [`${c.slot_id}|${c.date}`, c]))

  return days.map((day) => {
    const correction = byKey.get(`${day.slot_id}|${day.date}`)
    if (correction === undefined) return day
    return { ...day, names: day.names.slice(0, correction.filled) }
  })
}
