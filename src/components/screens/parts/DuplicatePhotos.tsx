import { Card } from '@/components/styled/Card'
import type { PhotoRecord } from '@/contract/schemas'
import type { DuplicateGroup } from '@/rules/quality'

interface DuplicatePhotosProps {
  readonly groups: readonly DuplicateGroup[]
  readonly photos: readonly PhotoRecord[]
}

const STAMP = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Asia/Jakarta',
})

const when = (iso: string | null): string => (iso === null ? 'no capture time' : STAMP.format(new Date(iso)))

/**
 * Photos sharing a perceptual hash, side by side.
 *
 * This is an accusation of fabricated evidence — the SOP scores it under
 * *data fiktif* — so it is never presented as a finding. The two are shown
 * together with their times and the hash they share, and a person decides.
 * Two genuinely identical shots of the same clean corridor an hour apart
 * are not fraud, and only someone who was there can say so.
 */
export function DuplicatePhotos({ groups, photos }: DuplicatePhotosProps) {
  const byId = new Map(photos.map((photo) => [photo.record_id, photo]))

  return (
    <Card
      title="Photos sharing an image"
      info="Two photos with the same perceptual hash — visually the same picture, not merely the same bytes. Shown side by side because that is the only form in which the accusation is safe to make: this maps to the SOP's data fiktif score, and a person has to look before anyone says the word."
    >
      {groups.length === 0 ? (
        <p className="text-[14px] text-muted">No two photos share an image.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {groups.map((group) => (
            <li key={group.hash} data-duplicate-pair={group.hash} className="border-b border-line pb-3 last:border-0">
              <p className="mb-1 text-[11.5px] tracking-[0.10em] text-faint uppercase">
                Shared hash {group.hash}
              </p>
              <div className="grid grid-cols-2 gap-3">
                {group.photoIds.map((id) => {
                  const photo = byId.get(id)
                  return (
                    <div key={id} className="rounded-[var(--radius-control)] border border-line p-2">
                      <div
                        aria-hidden="true"
                        className="mb-2 grid h-20 place-items-center rounded-[2px] bg-plane text-[11.5px] text-faint"
                      >
                        image not stored
                      </div>
                      <p className="text-[13px]">{id}</p>
                      <p className="text-[13px] text-muted">
                        taken {when(photo?.captured_at ?? null)}
                      </p>
                      <p className="text-[13px] text-muted">
                        received {photo === undefined ? 'unknown' : when(photo.received_at)}
                      </p>
                    </div>
                  )
                })}
              </div>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 border-t border-line pt-3 text-[13px] text-muted">
        The images themselves are not stored here — the agent keeps them. What is shown is what
        the records carry: the hash, and when each was taken and received.
      </p>
    </Card>
  )
}
