import { Card } from '@/components/styled/Card'
import { escalation, type EscalationStep } from '@/rules/heatmap'
import type { RepeatArea } from '@/rules/causes'

interface RepeatTrackerProps {
  readonly repeats: readonly RepeatArea[]
  readonly labelOf: (areaId: string | null) => string | null
}

const RUNG: Record<EscalationStep, { readonly label: string; readonly colour: string }> = {
  noticed: { label: 'Noticed', colour: 'var(--color-ordinal-1)' },
  repeat: { label: 'Came back', colour: 'var(--color-warning)' },
  escalating: { label: 'Escalating', colour: 'var(--color-critical)' },
}

const DATE = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })

/**
 * The escalation ladder, as a state you can see.
 *
 * The drill's point: a Toilet LT2 path should be legible on day one rather
 * than arriving as a formal complaint on day three. A count of complaints
 * cannot show that; a rung can.
 */
export function RepeatTracker({ repeats, labelOf }: RepeatTrackerProps) {
  return (
    <Card
      title="Coming back"
      info="An area complained about on more than one day. One day is noticed, two is came back, three or more is escalating — the ladder exists so a recurring problem is visible while it can still be fixed quietly, rather than arriving as a formal complaint later. Counts days, not complaints: twice in one morning is one day."
    >
      {repeats.length === 0 ? (
        <p className="text-[14px] text-muted">No area was complained about on more than one day.</p>
      ) : (
        <ul>
          {repeats.map((repeat) => {
            const step = escalation(repeat.days.length)
            const rung = RUNG[step]
            return (
              <li
                key={repeat.areaId}
                data-escalation={step}
                className="flex items-baseline justify-between gap-3 border-b border-line py-2 text-[14px] last:border-0"
              >
                <span className="min-w-0">
                  {labelOf(repeat.areaId) ?? repeat.areaId}
                  <span className="block text-[13px] text-faint">
                    {repeat.days.map((d) => DATE.format(new Date(`${d}T00:00:00Z`))).join(' · ')}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-2 whitespace-nowrap text-muted">
                  <span
                    aria-hidden="true"
                    className="size-2 rounded-full"
                    style={{ background: rung.colour }}
                  />
                  {rung.label}
                  <span className="tabular-nums">· {repeat.days.length} days</span>
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}
