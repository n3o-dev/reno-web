import { Card } from '@/components/styled/Card'
import { ChartTable } from '@/components/common/ChartTable'
import type { Heatmap } from '@/rules/heatmap'

interface AreaHeatmapProps {
  readonly heatmap: Heatmap
  readonly labelOf: (areaId: string | null) => string | null
}

const DAY = new Intl.DateTimeFormat('en-GB', {
  weekday: 'narrow',
  day: 'numeric',
  timeZone: 'UTC',
})

/*
 * Sequential, one hue, seven steps — magnitude, not identity. A cell with
 * no complaint is the plane rather than the ramp's lightest step: it is the
 * absence of a measurement, not the smallest one (DESIGN.md).
 */
const STEPS = [
  'var(--color-seq-1)',
  'var(--color-seq-2)',
  'var(--color-seq-3)',
  'var(--color-seq-4)',
  'var(--color-seq-5)',
  'var(--color-seq-6)',
  'var(--color-seq-7)',
]

export function AreaHeatmap({ heatmap, labelOf }: AreaHeatmapProps) {
  const shade = (count: number): string => {
    if (count === 0) return 'var(--color-plane)'
    const index = Math.min(STEPS.length - 1, Math.ceil((count / heatmap.peak) * STEPS.length) - 1)
    return STEPS[index] ?? STEPS[0] ?? 'var(--color-plane)'
  }

  return (
    <Card
      title="Where, day by day"
      info="One row per area, one column per day, shaded by how many complaints were raised. A total tells you thirty-five complaints; this tells you whether that was thirty-five places once or one place many times, which are different problems with different answers. Only the busiest areas are shown."
    >
      <table className="w-full border-collapse text-left text-[13px]">
        <caption className="sr-only">Complaints by area and day</caption>
        <thead>
          <tr className="text-faint">
            <th scope="col" className="px-0 py-1 font-normal">
              Area
            </th>
            {heatmap.days.map((day) => (
              <th key={day} scope="col" className="px-1 py-1 text-center font-normal">
                {DAY.format(new Date(`${day}T00:00:00Z`))}
              </th>
            ))}
            <th scope="col" className="px-1 py-1 text-right font-normal">
              All
            </th>
          </tr>
        </thead>
        <tbody>
          {heatmap.rows.map((row) => (
            <tr key={row.areaId ?? 'unnamed'} className="border-t border-line">
              <th scope="row" className="max-w-[14rem] py-1 pr-2 font-normal">
                {labelOf(row.areaId) ?? <span className="text-faint">No area named</span>}
              </th>
              {row.counts.map((count, i) => (
                <td key={heatmap.days[i] ?? i} className="px-1 py-1">
                  <span
                    title={`${count} on ${heatmap.days[i] ?? ''}`}
                    aria-label={`${count}`}
                    className="block h-5 rounded-[2px]"
                    style={{ background: shade(count) }}
                  />
                </td>
              ))}
              <td className="px-1 py-1 text-right tabular-nums">{row.total}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <ChartTable
        caption="Complaints by area and day, as numbers"
        headers={['Area', ...heatmap.days, 'All']}
        rows={heatmap.rows.map((row) => [
          labelOf(row.areaId) ?? 'No area named',
          ...row.counts.map(String),
          String(row.total),
        ])}
      />
    </Card>
  )
}
