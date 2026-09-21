import { readFile } from 'node:fs/promises'
import { cache } from 'react'
import { z } from 'zod'

/**
 * Corrections a person made to what the agent read.
 *
 * Keyed by the thing being corrected — one slot, one day — and not by the
 * name of a figure on a screen. That distinction is the whole point: an
 * override used to be applied while rendering, so the number under the
 * cursor changed and nothing else did. The per-area figures summed to one
 * total while the headline showed another, and an override whose own reason
 * said a slot went uncovered left the amount payable untouched.
 *
 * Applied to the data instead, every figure derived from that slot-day moves
 * together, including the invoice.
 *
 * Append-only and visible to the client: Reno correcting a figure quietly
 * would be worse than the agent being wrong.
 *
 * See docs/specs/reno-dashboard.md (AC-10).
 */
const slotDayOverride = z.strictObject({
  /** `<area>:<shift>`, matching the slot the billing rules use. */
  slot_id: z.string().min(1),
  date: z.iso.date(),
  /** How many people were actually there. */
  filled: z.int().min(0),
  /** Shown to the client verbatim. An override without one is rejected. */
  reason: z.string().min(1),
  by: z.string().min(1),
  at: z.iso.datetime({ offset: true }),
})

export type SlotDayOverride = z.infer<typeof slotDayOverride>

const OVERRIDES_FILE = 'fixtures/site/overrides.json'

export const getSlotOverrides = cache(async (): Promise<readonly SlotDayOverride[]> => {
  const raw: unknown = JSON.parse(await readFile(OVERRIDES_FILE, 'utf8'))
  return z.array(slotDayOverride).parse(raw)
})

/** The corrections touching one slot, newest last. */
export const overridesForSlot = (
  overrides: readonly SlotDayOverride[],
  slotId: string,
): readonly SlotDayOverride[] =>
  overrides.filter((o) => o.slot_id === slotId).sort((a, b) => a.at.localeCompare(b.at))
