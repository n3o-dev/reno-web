import { readFile } from 'node:fs/promises'
import { z } from 'zod'
import { cache } from 'react'
import type { SlotContract } from '@/rules/billing'

/**
 * The service contract's commercial terms.
 *
 * Two separate things live here and only one is known. The rate is what Reno
 * charges per person per month. The slot table is how many people the
 * contract requires in each area on each shift — which is what the rate gets
 * multiplied by, and what nobody has supplied yet.
 *
 * Until the slot table arrives the dashboard counts slot-days and states no
 * money, because the only numbers available to multiply by are derived from
 * the roster and are demonstrably wrong: the same 37 people appear on both
 * shifts, so deriving a contracted headcount from them counts everyone
 * twice.
 *
 * See docs/specs/monthly-report-pack.md
 */
const slot = z.strictObject({
  area_id: z.string().min(1),
  shift: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  contracted: z.int().min(0),
})

const contract = z.strictObject({
  site_id: z.string().min(1),
  currency: z.string().min(1),
  /** Per person per month. */
  monthly_rate_per_mp: z.number().positive(),
  working_days_per_week: z.int().min(1).max(7),
  /**
   * The divisor for a pro-rata deduction. Reno invoices monthly and deducts
   * on a 30-day basis; with a five-day week a missed day is worth rather
   * more than a thirtieth, so this is stated rather than assumed.
   */
  prorata_days_per_month: z.int().min(1).max(31),
  /** Null until Reno supplies it. */
  slots: z.array(slot).nullable(),
})

export type SiteContract = z.infer<typeof contract>

const CONTRACT_FILE = 'fixtures/site/contract.json'

export const getContract = cache(async (): Promise<SiteContract> => {
  const raw: unknown = JSON.parse(await readFile(CONTRACT_FILE, 'utf8'))
  return contract.parse(raw)
})

/** The contract's slot table as the billing rules want it, or null. */
export function contractSlots(site: SiteContract): readonly SlotContract[] | null {
  if (site.slots === null) return null
  return site.slots.map((s) => ({
    slot_id: `${s.area_id}:${s.shift}`,
    area_id: s.area_id,
    shift: s.shift,
    contracted: s.contracted,
  }))
}
