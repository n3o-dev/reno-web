export type SectionState = 'ready' | 'blocked' | 'human' | 'external'

interface PackSectionProps {
  readonly title: string
  readonly source: string
  readonly state: SectionState
}

const STATE_LABEL: Record<SectionState, string> = {
  ready: 'From data',
  blocked: 'Waiting',
  human: 'Human input',
  external: 'External',
}

const STATE_COLOUR: Record<SectionState, string> = {
  ready: 'var(--color-good)',
  blocked: 'var(--color-warning)',
  human: 'var(--color-faint)',
  external: 'var(--color-faint)',
}

/** Never colour alone: every state carries its label. */
export function PackSection({ title, source, state }: PackSectionProps) {
  return (
    <li className="flex items-baseline justify-between gap-4 border-b border-line py-3 text-[14px] last:border-0">
      <span>
        {title}
        <span className="block text-[13px] text-muted">{source}</span>
      </span>
      <span className="flex shrink-0 items-center gap-2 whitespace-nowrap text-muted">
        <span
          aria-hidden="true"
          className="size-2 rounded-full"
          style={{ background: STATE_COLOUR[state] }}
        />
        {STATE_LABEL[state]}
      </span>
    </li>
  )
}
