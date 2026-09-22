import { Card } from '@/components/styled/Card'
import { ChartTable } from '@/components/common/ChartTable'
import type { Coverage } from '@/rules/manpower'

interface AreaCoverageProps {
  readonly rows: readonly Coverage[]
  readonly days: number
}

const AREA_LABEL: Record<string, string> = {
  external: 'External',
  gf: 'Ground floor',
  ug: 'Upper ground',
  lt1: 'Level 1',
  lt2: 'Level 2',
  lk: 'Lower ground',
  garbage: 'Garbage',
  gondola: 'Gondola',
}

/** Present against contracted, per area, for the day on screen. */
export function AreaCoverage({ rows, days }: AreaCoverageProps) {
  const perDay = rows.map((row) => ({
    ...row,
    present: days === 0 ? 0 : Math.round(row.filled / days),
  }))

  return (
    <Card
      title="Who is where"
      info="Contracted headcount against the names in the day's line-up, per area. Claimed attendance: the project leader typed it, and it stays claimed until an admin confirms it. A short area is not necessarily a problem — someone may have been moved — but it is the thing to ask about."
    >
      <ul className="flex flex-col gap-2">
        {perDay.map((row) => {
          const short = row.present < row.contracted
          return (
            <li
              key={`${row.area_id}:${row.shift}`}
              className="grid grid-cols-[1fr_auto] items-center gap-x-3 text-[14px]"
            >
              <span>
                {AREA_LABEL[row.area_id] ?? row.area_id}
                <span className="text-faint"> · shift {row.shift}</span>
              </span>
              <span
                data-area-coverage={`${row.area_id}.${row.shift}`}
                className="tabular-nums"
                style={short ? { color: 'var(--color-warning)' } : undefined}
              >
                {row.present} / {row.contracted}
              </span>
              <div className="col-span-2 h-1.5 rounded-[var(--radius-bar)] bg-plane">
                <div
                  className="h-1.5 rounded-[var(--radius-bar)]"
                  style={{
                    width: `${Math.min(100, (row.present / Math.max(1, row.contracted)) * 100)}%`,
                    background: short ? 'var(--color-warning)' : 'var(--color-ordinal-2)',
                  }}
                />
              </div>
            </li>
          )
        })}
      </ul>

      <ChartTable
        caption="Present against contracted, by area and shift"
        headers={['Area', 'Shift', 'Present', 'Contracted']}
        rows={perDay.map((row) => [
          AREA_LABEL[row.area_id] ?? row.area_id,
          String(row.shift),
          String(row.present),
          String(row.contracted),
        ])}
      />
    </Card>
  )
}
