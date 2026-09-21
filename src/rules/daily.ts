/**
 * Per-day counts, the shape every activity chart needs.
 *
 * Days come from the records themselves rather than from a calendar: a day
 * the group was silent has no records and should not appear as a zero the
 * client reads as an outage.
 */
export interface DayCount {
  /** ISO date, `YYYY-MM-DD`. */
  readonly date: string
  readonly count: number
}

interface Dated {
  readonly sent_at: string
}

const dayOf = (record: Dated): string => record.sent_at.slice(0, 10)

export function countByDay(records: readonly Dated[]): readonly DayCount[] {
  const counts = new Map<string, number>()
  for (const record of records) {
    const day = dayOf(record)
    counts.set(day, (counts.get(day) ?? 0) + 1)
  }
  return [...counts.entries()]
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date))
}
