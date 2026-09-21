import { Card } from '@/components/styled/Card'
import type { DayCount } from '@/rules/daily'

interface ComplaintsByDayProps {
  readonly days: readonly DayCount[]
}

const WEEKDAY = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric' })

export function ComplaintsByDay({ days }: ComplaintsByDayProps) {
  const peak = Math.max(1, ...days.map((d) => d.count))
  return (
    <Card
      title="Complaints per day"
      info="How many complaints were raised in the group each day. A single day's spike is usually one inspection walk, not a collapse in standards — read it next to the closure rate."
    >
      <ol className="flex items-end gap-2">
        {days.map((day) => (
          <li key={day.date} className="flex min-w-0 flex-1 flex-col items-center gap-2">
            <span
              data-figure="complaints.raised_on_day"
              className="text-[13px] tabular-nums"
            >
              {day.count}
            </span>
            <div
              className="w-full rounded-t-[var(--radius-bar)] bg-[var(--color-ordinal-2)]"
              style={{ height: `${Math.max(4, (day.count / peak) * 120)}px` }}
            />
            <span className="text-[11.5px] whitespace-nowrap text-faint">
              {WEEKDAY.format(new Date(`${day.date}T00:00:00Z`))}
            </span>
          </li>
        ))}
      </ol>
    </Card>
  )
}
