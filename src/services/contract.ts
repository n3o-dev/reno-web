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
 * The slot table currently in use is assumed from the line-ups rather than
 * read from the contract, and `slots_source` says so. It is enough to run
 * the arithmetic end to end and will be replaced when the real figures
 * arrive — from the contract, or later from whatever API serves them. Every
 * amount derived from an assumed table is labelled provisional, because the
 * assumption is load-bearing: the same people appear on both shifts in the
 * rosters, so whether the site is 37 people or 74 is exactly the thing
 * nobody has confirmed.
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
  /**
   * Where the slot table came from. `assumed_from_lineups` means nobody has
   * supplied the contract's own figures and these were taken from the
   * rosters the group posts — good enough to run the arithmetic on, not good
   * enough to invoice from, and labelled as such everywhere the amount
   * appears.
   */
  slots_source: z.enum(['contract', 'assumed_from_lineups']),
  /** Null until anyone supplies it, assumed or otherwise. */
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
