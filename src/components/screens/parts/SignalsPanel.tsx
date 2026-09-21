import type { DoubleListing, HeadcountMismatch } from '@/rules/manpower'
import type { PersonRecord } from '@/contract/schemas'

interface SignalsPanelProps {
  readonly doubles: readonly DoubleListing[]
  readonly mismatches: readonly HeadcountMismatch[]
  readonly aliasCandidates: readonly PersonRecord[]
}

interface SignalProps {
  readonly label: string
  readonly count: number
  readonly detail: string
}

function Signal({ label, count, detail }: SignalProps) {
  return (
    <li className="flex items-baseline justify-between gap-4 border-b border-line py-3 last:border-0">
      <div>
        <p className="text-[14px]">{label}</p>
        <p className="text-[13px] text-muted">{detail}</p>
      </div>
      <span className="font-[family-name:var(--font-display)] text-[20px] tabular-nums">
        {count}
      </span>
    </li>
  )
}

/**
 * Reno only, and labelled as signals to check rather than as findings. Every
 * one of these has an innocent explanation available, and the screen never
 * asserts otherwise — a person opens the line-up and decides.
 */
export function SignalsPanel({ doubles, mismatches, aliasCandidates }: SignalsPanelProps) {
  return (
    <section
      data-reno-only="true"
      className="rounded-[var(--radius-card)] border border-line bg-surface p-5"
    >
      <h2 className="font-[family-name:var(--font-display)] text-[17px]">Signals to check</h2>
      <p className="mt-1 mb-3 text-[13px] text-muted">
        Not findings. Each one needs a person to open the line-up and decide.
      </p>
      <ul>
        <Signal
          label="Listed in two areas at once"
          count={doubles.length}
          detail="One of the two entries is wrong"
        />
        <Signal
          label="Headcount disagrees with the names"
          count={mismatches.length}
          detail="The stated total does not match the list"
        />
        <Signal
          label="Alias awaiting a decision"
          count={aliasCandidates.length}
          detail="Two spellings that may be one person"
        />
      </ul>
    </section>
  )
}
