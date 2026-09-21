import { Card } from '@/components/styled/Card'
import { areaLabel } from '@/rules/area'
import type { ComplaintRecord } from '@/contract/schemas'
import type { Evidence } from '@/services/evidence'

interface BlockedItemsProps {
  readonly complaints: readonly ComplaintRecord[]
  /** Keyed by record id: the message that justifies the block. */
  readonly citations: Readonly<Record<string, Evidence | undefined>>
}

const STAMP = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Asia/Jakarta',
})

/**
 * Blocked complaints, with the clock shown as paused and the citation one
 * click away.
 *
 * A block is the one state that stops the SLA running, so it is also the one
 * most worth abusing. The schema makes an uncited block unrepresentable and
 * this shows the citation next to the claim, so the client can read the
 * message that justifies the pause rather than taking Reno's word (AC-8).
 */
export function BlockedItems({ complaints, citations }: BlockedItemsProps) {
  if (complaints.length === 0) return null
  return (
    <Card
      title="Blocked — clock paused"
      info="Work that could not proceed for a reason outside Reno's control: equipment that never arrived, an area the client's own contractor was still working in. The 24-hour clock stops while an item is blocked and resumes when it clears. Every block names the message that justifies it, and a block without one is refused at ingest."
    >
      <ul>
        {complaints.map((complaint) => {
          const citation = citations[complaint.record_id]
          return (
            <li
              key={complaint.record_id}
              data-blocked={complaint.record_id}
              className="border-b border-line py-3 last:border-0"
            >
              <div className="flex items-baseline justify-between gap-3 text-[14px]">
                <span>
                  {areaLabel(complaint.area_id) ?? (
                    <span className="text-faint">No area named</span>
                  )}
                </span>
                <span className="flex shrink-0 items-center gap-1.5 text-muted">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-4" aria-hidden="true">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M10 9v6M14 9v6" strokeLinecap="round" />
                  </svg>
                  Paused
                </span>
              </div>
              <details className="mt-1">
                <summary
                  data-citation={complaint.record_id}
                  // 44px tall so a thumb can open it (AC-12).
                  className="inline-flex min-h-11 cursor-pointer items-center text-[13px] text-muted underline decoration-line"
                >
                  Why it is paused
                </summary>
                {citation === undefined || citation.kind !== 'message' ? (
                  <p className="mt-1 text-[13px] text-faint">
                    The citing message is not in the loaded records.
                  </p>
                ) : (
                  <p className="mt-1 text-[13px]">
                    <span className="font-medium">{citation.sender}</span>{' '}
                    <span className="text-faint tabular-nums">
                      {STAMP.format(new Date(citation.sentAt))}
                    </span>
                    <span className="block text-muted">{citation.text}</span>
                  </p>
                )}
              </details>
            </li>
          )
        })}
      </ul>
    </Card>
  )
}
