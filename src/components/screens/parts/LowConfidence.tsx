import { Card } from '@/components/styled/Card'
import { Figure } from '@/components/common/Figure'
import { areaLabel } from '@/rules/area'
import type { ComplaintRecord } from '@/contract/schemas'
import type { FigureEvidence } from '@/services/evidence'

interface LowConfidenceProps {
  readonly complaints: readonly ComplaintRecord[]
  readonly evidence: FigureEvidence
}

const TIME = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  timeZone: 'Asia/Jakarta',
})

/**
 * Complaints the agent was unsure about.
 *
 * Shown, never dropped. A record the agent half-read is still something a
 * person said in the group, and hiding it would quietly shrink every count
 * on this screen. It is marked so nobody mistakes it for a clean reading
 * (AC-13).
 */
export function LowConfidence({ complaints, evidence }: LowConfidenceProps) {
  if (complaints.length === 0) return null
  return (
    <Card
      title="Read with less certainty"
      info="The agent reports how sure it was of each reading. These fell below 60%, usually because the message named no area or the wording was ambiguous. They are counted in every figure on this screen — excluding them would make the numbers look tidier and be wrong."
    >
      <p className="mb-3 text-[14px]">
        <Figure
          name="complaints.low_confidence"
          evidence={evidence.items}
          total={evidence.total}
          className="font-[family-name:var(--font-display)] text-[20px] tabular-nums"
        >
          {complaints.length}
        </Figure>{' '}
        <span className="text-muted">of these are counted above</span>
      </p>
      <ul>
        {complaints.map((complaint) => (
          <li
            key={complaint.record_id}
            data-marker="low-confidence"
            className="flex items-baseline justify-between gap-3 border-b border-line py-2 text-[14px] last:border-0"
          >
            <span>
              {areaLabel(complaint.area_id) ?? (
                <span className="text-faint">No area named</span>
              )}
            </span>
            <span className="shrink-0 text-[13px] text-muted tabular-nums">
              {Math.round(complaint.confidence * 100)}% · {TIME.format(new Date(complaint.raised_at))}
            </span>
          </li>
        ))}
      </ul>
    </Card>
  )
}
