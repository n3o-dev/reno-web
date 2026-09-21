import type { Coverage } from '@/rules/manpower'

interface CoverageTableProps {
  readonly rows: readonly Coverage[]
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

export function CoverageTable({ rows }: CoverageTableProps) {
  return (
    <table className="w-full border-collapse text-left">
      <caption className="sr-only">Contracted against filled slot-days, by area and shift</caption>
      <thead>
        <tr className="text-[13px] tracking-[0.04em] text-faint">
          <th scope="col" className="px-0 py-2 font-normal">Area</th>
          <th scope="col" className="px-3 py-2 text-right font-normal">Shift</th>
          <th scope="col" className="px-3 py-2 text-right font-normal">Contracted</th>
          <th scope="col" className="px-0 py-2 text-right font-normal">Filled slot-days</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr
            key={`${row.area_id}:${row.shift}`}
            className="border-t border-line text-[14px]"
          >
            <th scope="row" className="px-0 py-2 font-normal">
              {AREA_LABEL[row.area_id] ?? row.area_id}
            </th>
            <td className="px-3 py-2 text-right tabular-nums">{row.shift}</td>
            <td className="px-3 py-2 text-right tabular-nums">{row.contracted}</td>
            <td
              data-figure={`manpower.filled.${row.area_id}.${row.shift}`}
              className="px-0 py-2 text-right tabular-nums"
            >
              {row.filled}
              <span className="text-faint"> / {row.contractedSlotDays}</span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
