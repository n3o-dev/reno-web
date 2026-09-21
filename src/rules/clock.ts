import type { ComplaintRecord, LifecycleState } from '@/contract/schemas'

/**
 * Complaint clocks.
 *
 * Pure: same input, same output, no clock read and no I/O. The caller supplies
 * every instant, including "now", so a figure can be recomputed identically
 * months later when a client disputes an invoice.
 *
 * See docs/specs/billing-and-scoring-rules.md
 */

/** SOP/OPS/001 A.3 — score 5 is zero complaints or closed under 24 hours. */
export const SLA_HOURS = 24

const MS_PER_HOUR = 3_600_000
const MS_PER_MINUTE = 60_000

export interface StateChange {
  readonly state: LifecycleState
  readonly at: string
  readonly source_message_id: string
}

export interface ElapsedInput {
  readonly from: string
  readonly to: string
  readonly history: readonly StateChange[]
}

export interface Elapsed {
  /** Wall-clock hours between `from` and `to`, less every blocked interval. */
  readonly hours: number
  readonly blockedHours: number
}

/**
 * Time the clock actually spent running. Entering `blocked` pauses it and
 * leaving `blocked` resumes it, so a complaint held up by an absent gondola
 * does not burn its SLA while nobody could act.
 */
export function elapsedExcludingBlocked({ from, to, history }: ElapsedInput): Elapsed {
  const start = Date.parse(from)
  const end = Date.parse(to)
  const ordered = [...history].sort((a, b) => Date.parse(a.at) - Date.parse(b.at))

  let blockedMs = 0
  let blockedSince: number | null = null
  for (const change of ordered) {
    const at = Date.parse(change.at)
    if (at <= start || at > end) continue
    if (change.state === 'blocked' && blockedSince === null) {
      blockedSince = at
      continue
    }
    if (change.state !== 'blocked' && blockedSince !== null) {
      blockedMs += at - blockedSince
      blockedSince = null
    }
  }
  if (blockedSince !== null) blockedMs += end - blockedSince

  return {
    hours: (end - start - blockedMs) / MS_PER_HOUR,
    blockedHours: blockedMs / MS_PER_HOUR,
  }
}

export interface ClosureStats {
  readonly raised: number
  readonly answered: number
  readonly closedWithPhoto: number
  /** Median minutes to the first reply. Null when nothing was answered. */
  readonly medianReplyMinutes: number | null
  /** Median minutes to a closing photo. Null when nothing closed. */
  readonly medianClosureMinutes: number | null
  readonly slowestClosureMinutes: number | null
}

function median(values: readonly number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 1) return sorted[mid] as number
  return (((sorted[mid - 1] as number) + (sorted[mid] as number)) / 2)
}

function firstAt(history: readonly StateChange[], state: LifecycleState): number | null {
  const found = [...history]
    .sort((a, b) => Date.parse(a.at) - Date.parse(b.at))
    .find((h) => h.state === state)
  return found ? Date.parse(found.at) : null
}

/**
 * Reply time and closure time are returned as separate figures and are never
 * merged. On the LWAS period they say opposite things: Reno replies in a
 * median of 3 minutes and closes in 41.
 */
export function closureStats(complaints: readonly ComplaintRecord[]): ClosureStats {
  const replies: number[] = []
  const closures: number[] = []

  for (const c of complaints) {
    if (c.state === 'blocked' && c.blocked_reason_message_id === null) {
      throw new Error(
        `complaint ${c.record_id} is blocked without a citation; an uncited block is invalid input, not a zero-duration block`,
      )
    }
    const raised = Date.parse(c.raised_at)
    const answeredAt = firstAt(c.state_history, 'answered')
    if (answeredAt !== null) replies.push((answeredAt - raised) / MS_PER_MINUTE)
    const closedAt = firstAt(c.state_history, 'closed_with_photo')
    if (closedAt !== null) closures.push((closedAt - raised) / MS_PER_MINUTE)
  }

  return {
    raised: complaints.length,
    answered: complaints.filter((c) => c.state !== 'raised').length,
    closedWithPhoto: complaints.filter((c) => c.state === 'closed_with_photo').length,
    medianReplyMinutes: median(replies),
    medianClosureMinutes: median(closures),
    slowestClosureMinutes: closures.length === 0 ? null : Math.max(...closures),
  }
}
