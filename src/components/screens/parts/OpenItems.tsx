import type { ComplaintRecord } from '@/contract/schemas'
import { areaLabel } from '@/rules/area'

interface OpenItemsProps {
  readonly complaints: readonly ComplaintRecord[]
}

const TIME = new Intl.DateTimeFormat('en-GB', {
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Asia/Jakarta',
})

const STATE_LABEL: Record<string, string> = {
  raised: 'Raised',
  answered: 'Answered',
  in_progress: 'In progress',
  blocked: 'Blocked — clock paused',
  closed_without_photo: 'Closed without photo',
}

/** Oldest first: the longest-running complaint is the one most worth seeing. */
export function OpenItems({ complaints }: OpenItemsProps) {
  const ordered = [...complaints].sort((a, b) => a.raised_at.localeCompare(b.raised_at))

  if (ordered.length === 0) {
    return <p className="text-[14px] text-muted">Nothing open on the latest reported day.</p>
  }

  return (
    <ul className="flex flex-col">
      {ordered.map((complaint) => (
        <li
          key={complaint.record_id}
          className="flex items-baseline justify-between gap-4 border-b border-line py-3 text-[14px] last:border-0"
        >
          <span className="min-w-0">
            {areaLabel(complaint.area_id) ?? <span className="text-faint">No area named</span>}
            {complaint.confidence < 0.6 && (
              <span
                data-marker="low-confidence"
                className="ml-2 rounded-[var(--radius-pill,999px)] border border-line px-2 py-0.5 text-[11.5px] text-muted"
              >
                low confidence
              </span>
            )}
          </span>
          <span className="shrink-0 text-right text-muted">
            <span className="block">{STATE_LABEL[complaint.state] ?? complaint.state}</span>
            <span className="block text-[13px] text-faint tabular-nums">
              {TIME.format(new Date(complaint.raised_at))}
            </span>
          </span>
        </li>
      ))}
    </ul>
  )
}
