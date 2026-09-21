import type { MessageRecord, PhotoRecord } from '@/contract/schemas'
import type { RecordSource } from '@/contract/source'

/**
 * What a figure can point at.
 *
 * A union rather than a list of message ids, because not every figure comes
 * from a message. RKB realisation is read out of Reno's workbook, where the
 * evidence is a sheet and a cell; a planned row nobody reported has no
 * message to cite at all, and saying so is better than inventing one.
 *
 * See docs/specs/reno-dashboard.md (AC-2) — the criterion says "source
 * message" and needs widening to this union; raised with the user.
 */
export type Evidence =
  | {
      readonly kind: 'message'
      readonly messageId: string
      readonly sender: string
      readonly sentAt: string
      readonly text: string
      readonly photoRef: string | null
    }
  | {
      readonly kind: 'workbook'
      readonly file: string
      readonly sheet: string
      readonly ref: string
    }
  | {
      readonly kind: 'absent'
      /** Why there is nothing to cite. Never blank. */
      readonly reason: string
    }

const TRUNCATE = 140

function photoFor(
  message: MessageRecord,
  photos: ReadonlyMap<string, PhotoRecord>,
): string | null {
  for (const id of message.photo_ids) {
    const photo = photos.get(id)
    if (photo !== undefined) return photo.storage_ref
  }
  return null
}

/**
 * Resolves message ids to the evidence a person can check.
 *
 * Deduplicated and capped: a figure standing on 414 messages is not made more
 * checkable by listing all 414, and the panel has to open on a phone. An id
 * the records cannot resolve is reported as absent rather than dropped —
 * silently showing four of five citations would overstate the evidence.
 */
export function resolveEvidence(
  source: RecordSource,
  messageIds: readonly string[],
  limit = 5,
): readonly Evidence[] {
  const messages = new Map(source.messages.map((m) => [m.source_message_id, m]))
  const photos = new Map(source.photos.map((p) => [p.record_id, p]))
  const seen = new Set<string>()
  const out: Evidence[] = []

  for (const id of messageIds) {
    if (seen.has(id)) continue
    seen.add(id)
    if (out.length >= limit) break
    const message = messages.get(id)
    if (message === undefined) {
      out.push({ kind: 'absent', reason: `message ${id} is not in the loaded records` })
      continue
    }
    out.push({
      kind: 'message',
      messageId: id,
      sender: message.sender_raw,
      sentAt: message.sent_at,
      text:
        message.text.length > TRUNCATE ? `${message.text.slice(0, TRUNCATE)}…` : message.text,
      photoRef: photoFor(message, photos),
    })
  }
  return out
}

/** How many distinct messages stand behind a figure, before the cap. */
export const countEvidence = (messageIds: readonly string[]): number =>
  new Set(messageIds).size

export interface FigureEvidence {
  readonly items: readonly Evidence[]
  readonly total: number
}

/**
 * Evidence for one figure, including a figure that counts nothing.
 *
 * A zero is still a claim — "no complaint was blocked this period" — and it
 * is the claim a client is most likely to dispute. It cites the absence in
 * words rather than opening an empty panel, which reads as a missing feature.
 */
export function bundleEvidence(
  source: RecordSource,
  messageIds: readonly string[],
  emptyReason: string,
): FigureEvidence {
  if (messageIds.length === 0) {
    /*
     * `total: 0`, not 1. Counting a stated absence as a source made the
     * evidence gate unfailable — `data-evidence` was never 0, so the check
     * that every figure cites something could never fire — and the panel
     * read "1 SOURCE" above the words "no work order is blocked". A figure
     * that stands on nothing should say nothing, and the gate has to be
     * able to tell the difference between "nothing happened" and "nobody
     * wired this up".
     */
    return { items: [{ kind: 'absent', reason: emptyReason }], total: 0 }
  }
  return { items: resolveEvidence(source, messageIds), total: countEvidence(messageIds) }
}
