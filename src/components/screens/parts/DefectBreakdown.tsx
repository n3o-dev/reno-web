import { Card } from '@/components/styled/Card'
import { Figure } from '@/components/common/Figure'
import type { FigureEvidence } from './ComplaintFunnel'
import type { DefectCount } from '@/rules/quality'
import type { Defect } from '@/contract/schemas'

interface DefectBreakdownProps {
  readonly defects: readonly DefectCount[]
  readonly reportCount: number
  /** Keyed by defect: the reports carrying it. */
  readonly evidence: Readonly<Record<string, FigureEvidence>>
}

const LABELS: Record<Defect, string> = {
  no_area: 'No area named',
  no_caption: 'No caption',
  done_without_complaint: 'Marked done with no complaint',
  photo_reused: 'Photo reused',
  photo_late_1h: 'Photo over 1 h late',
  photo_late_3h: 'Photo over 3 h late',
  photo_before_complaint: 'Photo predates the complaint',
}

/**
 * One series, so one colour and no legend — the title names it. Defects that
 * did not occur are left out rather than drawn as a zero: an empty bar reads
 * as a measurement, and these were not measured here.
 */
export function DefectBreakdown({ defects, reportCount, evidence }: DefectBreakdownProps) {
  const present = defects.filter((d) => d.count > 0)
  const peak = Math.max(1, ...present.map((d) => d.count))

  return (
    <Card
      title="Where reporting failed"
      info="Counted across every work report in the period. A report can carry more than one defect. Photo timing and reuse are checked against the photo's own metadata, so they appear under Evidence rather than here."
    >
      <ul className="flex flex-col gap-3">
        {present.map((entry) => (
          <li key={entry.defect} className="grid grid-cols-[1fr_auto] items-center gap-x-3">
            <span className="text-[14px]">{LABELS[entry.defect]}</span>
            <Figure
              name={`quality.defect.${entry.defect}`}
              evidence={evidence[entry.defect]?.items ?? []}
              total={evidence[entry.defect]?.total ?? 0}
              className="text-[14px] tabular-nums"
            >
              {entry.count}
            </Figure>
            <div className="col-span-2 h-2 rounded-[var(--radius-bar)] bg-plane">
              <div
                className="h-2 rounded-[var(--radius-bar)] bg-[var(--color-ordinal-2)]"
                style={{ width: `${(entry.count / peak) * 100}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-4 border-t border-line pt-3 text-[13px] text-muted">
        Out of <span className="tabular-nums">{reportCount}</span> reports
      </p>
    </Card>
  )
}
