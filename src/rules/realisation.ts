/**
 * RKB realisation — the only percentage in the system, and the one the Pimpro
 * is scored on at 30% weight.
 *
 * Pure. See docs/specs/billing-and-scoring-rules.md
 */

export interface PlanCell {
  readonly job_row_id: string
  readonly date: string
  /** R — planned in the workbook. */
  readonly planned: boolean
  /** A — matched to a work report. */
  readonly done: boolean
  /** Could not proceed for a reason outside Reno's control, with a cited message. */
  readonly blocked: boolean
}

export interface Realisation {
  readonly planned: number
  readonly done: number
  readonly blocked: number
  /** done / planned. Counts blocked rows against Reno. */
  readonly gross: number
  /** done / (planned - blocked). Null when every planned row was blocked. */
  readonly net: number | null
  readonly evidence: readonly string[]
}

/**
 * Returns gross and net together, always. There is deliberately no code path
 * that yields one without the other: the client sees both, and scoring uses
 * net so an absent gondola does not cost the Pimpro his rapor.
 */
export function computeRealisation(cells: readonly PlanCell[]): Realisation {
  const planned = cells.filter((c) => c.planned)
  const done = planned.filter((c) => c.done)
  const blocked = planned.filter((c) => c.blocked)
  const netDenominator = planned.length - blocked.length

  return {
    planned: planned.length,
    done: done.length,
    blocked: blocked.length,
    gross: planned.length === 0 ? 0 : done.length / planned.length,
    net: netDenominator <= 0 ? null : done.length / netDenominator,
    evidence: planned.map((c) => `${c.job_row_id}@${c.date}`),
  }
}
