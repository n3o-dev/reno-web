import { Card } from '@/components/styled/Card'

export interface DueRow {
  readonly sheet: string
  readonly section: string
  readonly no: number
  readonly subject: string
  readonly done: boolean
  readonly blocked: boolean
}

interface DueTodayProps {
  readonly rows: readonly DueRow[]
  /** Null when the loaded workbook does not cover the day on screen. */
  readonly coversToday: string | null
}

/** RKB job rows the plan schedules for the day on screen. */
export function DueToday({ rows, coversToday }: DueTodayProps) {
  return (
    <Card
      title="Planned for today"
      info="The job rows the RKB schedules for this day, and whether each has been reported yet. A row still open at the end of the day is what pulls realisation down at month end, which is the figure the Pimpro is scored on at 30% weight."
    >
      {coversToday !== null ? (
        <p className="text-[14px] text-muted">{coversToday}</p>
      ) : rows.length === 0 ? (
        <p className="text-[14px] text-muted">Nothing is planned for this day.</p>
      ) : (
        <ul>
          {rows.map((row) => (
            <li
              key={`${row.sheet}-${row.section}-${row.no}`}
              data-due-row
              className="flex items-baseline justify-between gap-3 border-b border-line py-2 text-[14px] last:border-0"
            >
              <span className="min-w-0">
                {row.subject}
                <span className="block text-[13px] text-faint">
                  {row.sheet.trim()} · {row.section}
                </span>
              </span>
              <span className="shrink-0 whitespace-nowrap text-muted">
                {row.blocked ? 'Blocked' : row.done ? 'Done' : 'Not yet'}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
