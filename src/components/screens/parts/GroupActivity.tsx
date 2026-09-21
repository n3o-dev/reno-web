import { Card } from '@/components/styled/Card'
import type { DayCount } from '@/rules/daily'

export interface ActivitySeries {
  readonly key: string
  readonly label: string
  readonly days: readonly DayCount[]
}

interface GroupActivityProps {
  readonly series: readonly ActivitySeries[]
}

const DAY = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric' })
const total = (days: readonly DayCount[]): number => days.reduce((sum, d) => sum + d.count, 0)

/**
 * Small multiples rather than three series on one axis. Messages contain the
 * photos and the reports, so drawing them together invites reading the gap
 * between them as a shortfall. Each row keeps its own scale; the totals are
 * what compare.
 */
export function GroupActivity({ series }: GroupActivityProps) {
  const labels = series[0]?.days ?? []

  return (
    <Card
      title="Group activity"
      info="Everything the agent read in the site group each day: every message, the photos among them, and the messages it could read as a work report. Messages include the photos and the reports, so the three rows are drawn on their own scales and are not compared against each other."
    >
      <div className="flex flex-col gap-5">
        {series.map((row) => {
          const peak = Math.max(1, ...row.days.map((d) => d.count))
          return (
            <div key={row.key}>
              <div className="flex items-baseline justify-between">
                <span className="text-[11.5px] tracking-[0.10em] text-faint uppercase">
                  {row.label}
                </span>
                <span
                  data-figure={`quality.activity.${row.key}`}
                  className="font-[family-name:var(--font-display)] text-[20px] tabular-nums"
                >
                  {total(row.days)}
                </span>
              </div>
              <ol className="mt-2 flex h-14 items-end gap-2">
                {row.days.map((day) => (
                  <li key={day.date} className="flex-1">
                    <div
                      data-figure={`quality.activity.${row.key}.day`}
                      data-count={day.count}
                      title={`${day.date}: ${day.count}`}
                      className="rounded-t-[var(--radius-bar)] bg-[var(--color-ordinal-2)]"
                      style={{ height: `${Math.max(3, (day.count / peak) * 56)}px` }}
                    />
                  </li>
                ))}
              </ol>
            </div>
          )
        })}
        <ol className="flex gap-2">
          {labels.map((day) => (
            <li key={day.date} className="flex-1 text-center text-[11.5px] text-faint">
              {DAY.format(new Date(`${day.date}T00:00:00Z`))}
            </li>
          ))}
        </ol>
      </div>
    </Card>
  )
}
