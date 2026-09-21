import { Card } from '@/components/styled/Card'
import type { ClosureStats } from '@/rules/clock'

interface ResponseTimesProps {
  readonly stats: ClosureStats
}

const minutes = (value: number | null): string =>
  value === null ? 'no data' : `${Math.round(value)} min`

/**
 * The two medians sit side by side and are never averaged into one number.
 * On the LWAS period they say opposite things — a 3-minute reply and a
 * 41-minute closure — and a single "response time" would hide the second.
 */
export function ResponseTimes({ stats }: ResponseTimesProps) {
  return (
    <Card
      title="Reply and closure"
      info="Median minutes from a complaint being raised to Reno's first reply, and to the photo that closes it. Medians, not averages: one 17-hour outlier would drag an average past anything typical. Shown apart because a fast reply is not a fast fix."
    >
      <dl className="grid grid-cols-2 gap-4">
        <div>
          <dt className="text-[11.5px] tracking-[0.10em] text-faint uppercase">To first reply</dt>
          <dd
            data-figure="complaints.median_reply_minutes"
            className="font-[family-name:var(--font-display)] text-[32px] leading-[1.05] tabular-nums"
          >
            {minutes(stats.medianReplyMinutes)}
          </dd>
        </div>
        <div>
          <dt className="text-[11.5px] tracking-[0.10em] text-faint uppercase">
            To closing photo
          </dt>
          <dd
            data-figure="complaints.median_closure_minutes"
            className="font-[family-name:var(--font-display)] text-[32px] leading-[1.05] tabular-nums"
          >
            {minutes(stats.medianClosureMinutes)}
          </dd>
        </div>
      </dl>
      {stats.slowestClosureMinutes !== null && (
        <p className="mt-4 border-t border-line pt-3 text-[13px] text-muted">
          Slowest closure {Math.round(stats.slowestClosureMinutes / 60)} h
        </p>
      )}
    </Card>
  )
}
