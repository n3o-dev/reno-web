import { Card } from '@/components/styled/Card'

interface EvidenceQualityProps {
  readonly beforeAfter: number
  readonly reportCount: number
  readonly latePhotos: number
  readonly duplicatePairs: number
}

interface RowProps {
  readonly figure: string
  readonly label: string
  readonly value: string
  readonly note: string
}

function Row({ figure, label, value, note }: RowProps) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-line py-3 last:border-0">
      <div>
        <p className="text-[14px]">{label}</p>
        <p className="text-[13px] text-muted">{note}</p>
      </div>
      <span
        data-figure={figure}
        className="font-[family-name:var(--font-display)] text-[20px] tabular-nums"
      >
        {value}
      </span>
    </div>
  )
}

export function EvidenceQuality({
  beforeAfter,
  reportCount,
  latePhotos,
  duplicatePairs,
}: EvidenceQualityProps) {
  const share = reportCount === 0 ? 0 : Math.round((beforeAfter / reportCount) * 100)
  return (
    <Card
      title="Evidence"
      info="Checked against each photo's own metadata rather than against what the caption claims. A photo with no capture time is not counted as late: an unknown gap is not a long one. Reused photos are shown side by side on request, because that is the only form in which the accusation is safe to make."
    >
      <Row
        figure="quality.before_after"
        label="Before and after"
        note={`${share}% of reports`}
        value={String(beforeAfter)}
      />
      <Row
        figure="quality.late_photos"
        label="Sent over 3 h after capture"
        note="Photos only"
        value={String(latePhotos)}
      />
      <Row
        figure="quality.duplicate_pairs"
        label="Photos sharing an image"
        note="Needs a human decision"
        value={String(duplicatePairs)}
      />
    </Card>
  )
}
