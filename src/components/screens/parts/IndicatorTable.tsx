import { AUTO_FILLED, RAPOR_INDICATORS, type Indicator, type Rapor } from '@/rules/rapor'

interface IndicatorTableProps {
  readonly rapor: Rapor
}

const LABEL: Record<Indicator, string> = {
  'A.1': 'RKB realisation',
  'A.2': 'Work method and SOP',
  'A.3': 'Complaint handling',
  'A.4': 'Area condition',
  'B.1': 'Chemical and equipment use',
  'B.2': 'Equipment condition',
  'B.3': 'Stock control',
  'C.1': 'Grooming',
  'C.2': 'Training completed',
  'C.3': 'Attendance discipline',
  'D.1': 'Reporting on time',
  'D.2': 'Coordination with the client',
  'D.3': 'Report quality',
}

export function IndicatorTable({ rapor }: IndicatorTableProps) {
  return (
    <table className="w-full border-collapse text-left">
      <caption className="sr-only">Rapor Pimpro indicators</caption>
      <thead>
        <tr className="text-[13px] tracking-[0.04em] text-faint">
          <th scope="col" className="px-0 py-2 font-normal">Indicator</th>
          <th scope="col" className="px-3 py-2 font-normal">Source</th>
          <th scope="col" className="px-0 py-2 text-right font-normal">Score</th>
        </tr>
      </thead>
      <tbody>
        {RAPOR_INDICATORS.map((indicator) => {
          const score = rapor.scores[indicator]
          const auto = AUTO_FILLED.includes(indicator)
          return (
            <tr key={indicator} className="border-t border-line text-[14px]">
              <th scope="row" className="px-0 py-2 font-normal">
                <span className="text-faint tabular-nums">{indicator} </span>
                {LABEL[indicator]}
              </th>
              <td className="px-3 py-2 text-muted">{auto ? 'From data' : 'Human input'}</td>
              <td
                data-figure={`rapor.score.${indicator}`}
                className="px-0 py-2 text-right tabular-nums"
              >
                {score ?? <span className="text-faint">not scored</span>}
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
