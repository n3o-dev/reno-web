import type { Evidence } from '@/services/evidence'

interface FigureProps {
  /** Stable name the tests walk: `complaints.raised`. */
  readonly name: string
  readonly children: React.ReactNode
  readonly evidence: readonly Evidence[]
  /** Distinct sources behind the figure, before the panel's cap. */
  readonly total: number
  readonly className?: string
  /** Set to `completion` only on RKB realisation — it is the only one (AC-7). */
  readonly kind?: 'completion'
}

const STAMP = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Asia/Jakarta',
})

function Item({ item }: { readonly item: Evidence }) {
  if (item.kind === 'absent') {
    return <li className="py-2 text-[13px] text-faint">{item.reason}</li>
  }
  if (item.kind === 'workbook') {
    return (
      <li className="border-b border-line py-2 text-[13px] last:border-0">
        <span className="text-muted">{item.file}</span> · {item.sheet} · cell {item.ref}
      </li>
    )
  }
  return (
    <li className="border-b border-line py-2 text-[13px] last:border-0">
      <span className="flex justify-between gap-3">
        <span className="font-medium">{item.sender}</span>
        <span className="shrink-0 text-faint tabular-nums">
          {STAMP.format(new Date(item.sentAt))}
        </span>
      </span>
      {item.text !== '' && <span className="block text-muted">{item.text}</span>}
      {item.photoRef !== null && <span className="block text-faint">photo {item.photoRef}</span>}
    </li>
  )
}

/**
 * A number and the evidence behind it, one click apart.
 *
 * The whole promise of the dashboard is that a figure the client disputes can
 * be traced back to what someone actually posted in the group. That only
 * holds if the trace is on the figure itself rather than in a report nobody
 * opens, so the panel ships with every figure and `pnpm test:evidence` fails
 * on any that resolves to nothing.
 */
export function Figure({ name, children, evidence, total, className, kind }: FigureProps) {
  const shown = evidence.length
  return (
    <span className="inline-flex items-baseline gap-1.5">
      <span
        data-figure={name}
        data-evidence={total}
        {...(kind === undefined ? {} : { 'data-figure-kind': kind })}
        className={className}
      >
        {children}
      </span>
      <details className="group relative inline-block">
        <summary
          aria-label={`Evidence for ${name}`}
          className="grid size-6 cursor-pointer place-items-center rounded-full text-faint marker:content-none hover:bg-plane hover:text-muted"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-3.5" aria-hidden="true">
            <path d="M7 11V7a5 5 0 0 1 10 0v4" strokeLinecap="round" />
            <rect x="4" y="11" width="16" height="9" rx="2" />
          </svg>
        </summary>
        <div className="absolute top-8 right-0 z-20 w-72 rounded-[var(--radius-control)] border border-line bg-surface p-3 text-left shadow-sm">
          <p className="mb-1 text-[11.5px] tracking-[0.10em] text-faint uppercase">
            {total === 0
              ? 'No source'
              : `${total} source${total === 1 ? '' : 's'}${shown < total ? `, showing ${shown}` : ''}`}
          </p>
          <ul>
            {evidence.map((item, index) => (
              <Item key={item.kind === 'message' ? item.messageId : `${item.kind}-${index}`} item={item} />
            ))}
          </ul>
        </div>
      </details>
    </span>
  )
}
