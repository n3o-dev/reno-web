import { Card } from '@/components/styled/Card'
import { Figure } from '@/components/common/Figure'
import type { ClosureStats } from '@/rules/clock'
import type { FigureEvidence } from './ComplaintFunnel'

interface ResponseTimesProps {
  readonly stats: ClosureStats
  readonly replyEvidence: FigureEvidence
  readonly closureEvidence: FigureEvidence
}

const minutes = (value: number | null): string =>
  value === null ? 'no data' : `${Math.round(value)} min`

/**
 * The two medians sit side by side and are never averaged into one number.
 * On the LWAS period they say opposite things — a 3-minute reply and a
 * 41-minute closure — and a single "response time" would hide the second.
 */
export function ResponseTimes({ stats, replyEvidence, closureEvidence }: ResponseTimesProps) {
  return (
    <Card
      title="Reply and closure"
      info="Median minutes from a complaint being raised to Reno's first reply, and to the photo that closes it. Medians, not averages: one 17-hour outlier would drag an average past anything typical. Shown apart because a fast reply is not a fast fix."
    >
      <dl className="grid grid-cols-2 gap-4">
        <div>
          <dt className="text-[11.5px] tracking-[0.10em] text-faint uppercase">To first reply</dt>
          <dd>
            <Figure
              name="complaints.median_reply_minutes"
              evidence={replyEvidence.items}
              total={replyEvidence.total}
              className="font-[family-name:var(--font-display)] text-[32px] leading-[1.05] tabular-nums"
            >
              {minutes(stats.medianReplyMinutes)}
            </Figure>
          </dd>
        </div>
        <div>
          <dt className="text-[11.5px] tracking-[0.10em] text-faint uppercase">
            To closing photo
          </dt>
          <dd>
            <Figure
              name="complaints.median_closure_minutes"
              evidence={closureEvidence.items}
              total={closureEvidence.total}
              className="font-[family-name:var(--font-display)] text-[32px] leading-[1.05] tabular-nums"
            >
              {minutes(stats.medianClosureMinutes)}
            </Figure>
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
