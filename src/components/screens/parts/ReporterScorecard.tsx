import { Card } from '@/components/styled/Card'
import { ChartTable } from '@/components/common/ChartTable'
import { Figure } from '@/components/common/Figure'
import type { ReporterScore } from '@/rules/reporters'
import type { FigureEvidence } from '@/services/evidence'

interface ReporterScorecardProps {
  readonly scores: readonly ReporterScore[]
  readonly evidence: Readonly<Record<string, FigureEvidence>>
}

/**
 * Report quality per person who files them. Reno-only.
 *
 * Not a league table. The point is to find the one leader whose reports
 * never name an area — something a site-wide pass rate hides completely —
 * not to rank eight colleagues against each other. Ordered worst-first
 * because that is the row worth opening the screen for, and the report
 * count sits beside every rate so a person with four reports is not read
 * as a person with four hundred.
 */
export function ReporterScorecard({ scores, evidence }: ReporterScorecardProps) {
  return (
    <Card
      title="By reporter"
      info="How each person's own reports fare against the same checks. Lowest pass rate first, with the number of reports beside it: one defect in four reports is not the same as one in four hundred, and a rate alone cannot tell you which you are looking at. This is for finding a habit worth a quiet word, not for ranking people."
    >
      <table className="w-full border-collapse text-left text-[14px]">
        <caption className="sr-only">Report quality by reporter</caption>
        <thead>
          <tr className="text-[13px] tracking-[0.04em] text-faint">
            <th scope="col" className="px-0 py-2 font-normal">Reporter</th>
            <th scope="col" className="px-2 py-2 text-right font-normal">Reports</th>
            <th scope="col" className="px-2 py-2 text-right font-normal">Before/after</th>
            <th scope="col" className="px-0 py-2 text-right font-normal">Passed</th>
          </tr>
        </thead>
        <tbody>
          {scores.map((score) => (
            <tr key={score.reporter} className="border-t border-line">
              <th scope="row" className="max-w-[12rem] px-0 py-2 font-normal">
                {score.reporter}
              </th>
              <td className="px-2 py-2 text-right tabular-nums">
                <Figure
                  name={`quality.reporter.${score.reporter}`}
                  evidence={evidence[score.reporter]?.items ?? []}
                  total={evidence[score.reporter]?.total ?? 0}
                >
                  {score.reports}
                </Figure>
              </td>
              <td className="px-2 py-2 text-right tabular-nums">{score.beforeAfter}</td>
              <td className="px-0 py-2 text-right tabular-nums">
                {Math.round(score.passRate * 100)}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <ChartTable
        caption="Report quality by reporter"
        headers={['Reporter', 'Reports', 'Clean', 'Before/after', 'Pass rate']}
        rows={scores.map((s) => [
          s.reporter,
          String(s.reports),
          String(s.clean),
          String(s.beforeAfter),
          `${Math.round(s.passRate * 100)}%`,
        ])}
      />
    </Card>
  )
}
