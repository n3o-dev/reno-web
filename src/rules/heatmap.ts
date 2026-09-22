import type { ComplaintRecord } from '@/contract/schemas'

/**
 * Complaints by area and day.
 *
 * A total says thirty-five complaints; this says whether that was
 * thirty-five places once or one place thirty-five times, which are
 * different problems with different answers.
 */
export interface HeatmapRow {
  readonly areaId: string | null
  readonly counts: readonly number[]
  readonly total: number
}

export interface Heatmap {
  readonly days: readonly string[]
  readonly rows: readonly HeatmapRow[]
  /** The largest single cell, for scaling the ramp. */
  readonly peak: number
}

export function complaintHeatmap(
  complaints: readonly ComplaintRecord[],
  days: readonly string[],
  limit = 12,
): Heatmap {
  const byArea = new Map<string | null, number[]>()
  for (const complaint of complaints) {
    const row = byArea.get(complaint.area_id) ?? days.map(() => 0)
    const index = days.indexOf(complaint.raised_at.slice(0, 10))
    if (index !== -1) row[index] = (row[index] ?? 0) + 1
    byArea.set(complaint.area_id, row)
  }

  const rows = [...byArea.entries()]
    .map(([areaId, counts]) => ({
      areaId,
      counts,
      total: counts.reduce((a, b) => a + b, 0),
    }))
    // Busiest first, then by how many days it recurred — a row that is one
    // tall column is less interesting than one that keeps coming back.
    .sort(
      (a, b) =>
        b.total - a.total ||
        b.counts.filter((n) => n > 0).length - a.counts.filter((n) => n > 0).length,
    )
    .slice(0, limit)

  return {
    days,
    rows,
    peak: Math.max(1, ...rows.flatMap((r) => r.counts)),
  }
}

export type EscalationStep = 'noticed' | 'repeat' | 'escalating'

/**
 * How far up the ladder an area has climbed.
 *
 * The drill's point: a Toilet LT2 path should be legible on day one rather
 * than arriving as a formal complaint on day three.
 */
export function escalation(days: number): EscalationStep {
  if (days >= 3) return 'escalating'
  if (days === 2) return 'repeat'
  return 'noticed'
}
