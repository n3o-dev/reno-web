import { Figure } from '@/components/common/Figure'
import type { Coverage } from '@/rules/manpower'
import type { FigureEvidence } from './ComplaintFunnel'

interface CoverageTableProps {
  readonly rows: readonly Coverage[]
  readonly evidence: FigureEvidence
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

export function CoverageTable({ rows, evidence }: CoverageTableProps) {
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
            <td className="px-0 py-2 text-right tabular-nums">
              <Figure
                name={`manpower.filled.${row.area_id}.${row.shift}`}
                evidence={evidence.items}
                total={evidence.total}
              >
                {row.filled}
              </Figure>
              <span className="text-faint"> / {row.contractedSlotDays}</span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
