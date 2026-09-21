/**
 * Slot billing.
 *
 * The billing unit is the slot — one area, one shift, one day — never the
 * person. A covered slot bills in full whoever fills it; an unfilled,
 * unreplaced slot-day deducts pro-rata.
 *
 * Complaints are absent from this module on purpose. Billing is manpower: a
 * filthy toilet costs the Pimpro his score and eventually the contract, but it
 * never touches the invoice.
 *
 * Pure. See docs/specs/billing-and-scoring-rules.md
 */

/** Off Day is planned leave and is already priced into the contract. */
export const ABSENCE_REASONS = ['off_day', 'sakit', 'izin', 'alfa'] as const
export type AbsenceReason = (typeof ABSENCE_REASONS)[number]

const NEVER_DEDUCTS: ReadonlySet<AbsenceReason> = new Set<AbsenceReason>(['off_day'])

export interface SlotContract {
  readonly slot_id: string
  readonly area_id: string
  readonly shift: 1 | 2 | 3
  readonly contracted: number
}

export interface Absence {
  readonly reason: AbsenceReason
  readonly count: number
}

export interface SlotDay {
  readonly slot_id: string
  readonly date: string
  /** Names appearing in that shift's line-up for this slot. */
  readonly names: readonly string[]
  readonly absences: readonly Absence[]
  /** The line-up message this slot-day was read from. */
  readonly source_message_id: string
}

export interface BillingInput {
  readonly contracts: readonly SlotContract[]
  readonly days: readonly SlotDay[]
  readonly monthlyRatePerMp: number
}

export interface Billing {
  readonly contractedSlotDays: number
  readonly filledSlotDays: number
  readonly unfilledSlotDays: number
  readonly gross: number
  readonly deduction: number
  readonly payable: number
  /** `source_message_id`s of the line-ups behind the figure. */
  readonly evidence: readonly string[]
}

/** A month of pro-rata is priced on 30 days, matching how Reno invoices. */
const DAYS_PER_MONTH = 30

export function computeBilling({ contracts, days, monthlyRatePerMp }: BillingInput): Billing {
  const byId = new Map(contracts.map((c) => [c.slot_id, c]))
  const dailyRate = monthlyRatePerMp / DAYS_PER_MONTH

  let filled = 0
  let unfilled = 0
  const evidence: string[] = []

  for (const day of days) {
    const contract = byId.get(day.slot_id)
    if (contract === undefined) {
      throw new Error(`slot-day ${day.slot_id}@${day.date} has no contracted slot`)
    }
    const shortfall = contract.contracted - day.names.length
    const excused = day.absences
      .filter((a) => NEVER_DEDUCTS.has(a.reason))
      .reduce((n, a) => n + a.count, 0)
    const chargeable = Math.max(0, shortfall - excused)

    filled += contract.contracted - chargeable
    unfilled += chargeable
    evidence.push(day.source_message_id)
  }

  const contracted = filled + unfilled
  /**
   * A month is invoiced on the full contracted manpower and then deducted, so
   * `gross` deliberately does not scale with how many slot-days were supplied.
   * Pass a whole month of `days`, not a slice, or the deduction will be wrong.
   */
  const gross = contracts.reduce((n, c) => n + c.contracted, 0) * monthlyRatePerMp
  const deduction = Math.round(unfilled * dailyRate)

  return {
    contractedSlotDays: contracted,
    filledSlotDays: filled,
    unfilledSlotDays: unfilled,
    gross,
    deduction,
    payable: gross - deduction,
    evidence,
  }
}
