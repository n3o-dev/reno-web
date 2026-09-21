import { Card } from '@/components/styled/Card'
import { Figure } from '@/components/common/Figure'
import type { ClosureStats } from '@/rules/clock'
import type { Evidence } from '@/services/evidence'

export interface FigureEvidence {
  readonly items: readonly Evidence[]
  readonly total: number
}

interface ComplaintFunnelProps {
  readonly stats: ClosureStats
  readonly evidence: Readonly<Record<'raised' | 'answered' | 'closed_with_photo', FigureEvidence>>
}

/*
 * Ordinal, not categorical: raised → answered → closed is a sequence, so the
 * three steps take the ordinal ramp darkest-first (DESIGN.md).
 */
const STEPS = [
  { key: 'raised', label: 'Raised', colour: 'var(--color-ordinal-3)' },
  { key: 'answered', label: 'Answered', colour: 'var(--color-ordinal-2)' },
  { key: 'closed_with_photo', label: 'Closed with photo', colour: 'var(--color-ordinal-1)' },
] as const

export function ComplaintFunnel({ stats, evidence }: ComplaintFunnelProps) {
  const values = {
    raised: stats.raised,
    answered: stats.answered,
    closed_with_photo: stats.closedWithPhoto,
  }

  return (
    <Card
      title="From raised to closed"
      info="Every complaint the agent read in the group, then how far each one travelled. Answered means Reno replied; closed with photo means a photo of the finished work was posted. A reply is not a closure."
    >
      <ul className="flex flex-col gap-3">
        {STEPS.map((step) => {
          const value = values[step.key]
          const share = stats.raised === 0 ? 0 : value / stats.raised
          const cited = evidence[step.key]
          return (
            <li key={step.key}>
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-[14px]">{step.label}</span>
                <Figure
                  name={`complaints.${step.key}`}
                  evidence={cited.items}
                  total={cited.total}
                  className="font-[family-name:var(--font-display)] text-[20px] tabular-nums"
                >
                  {value}
                </Figure>
              </div>
              <div className="mt-1 h-2 rounded-[var(--radius-bar)] bg-plane">
                <div
                  className="h-2 rounded-[var(--radius-bar)]"
                  style={{ width: `${share * 100}%`, background: step.colour }}
                />
              </div>
            </li>
          )
        })}
      </ul>
    </Card>
  )
}
