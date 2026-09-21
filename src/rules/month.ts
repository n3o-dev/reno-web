import { closureStats } from './clock'
import { computeRealisation, type PlanCell } from './realisation'
import { computeBilling, type BillingInput } from './billing'
import { computeRapor, type RaporInput } from './rapor'
import type { Corrected } from './override'
import type { ComplaintRecord } from '@/contract/schemas'

/**
 * One month, assembled. Every figure it returns carries the evidence behind
 * it, so nothing on a screen or in the report pack can be unsourced.
 *
 * Pure. See docs/specs/billing-and-scoring-rules.md (AC-12)
 */

export interface MonthInput {
  readonly complaints: readonly ComplaintRecord[]
  readonly cells: readonly PlanCell[]
  readonly billing: BillingInput
  readonly rapor: RaporInput
}

export interface Month {
  readonly figures: Readonly<Record<string, Corrected<number | null>>>
}

const figure = (value: number | null, evidence: readonly string[]): Corrected<number | null> => ({
  value,
  evidence,
})

export function computeMonth(input: MonthInput): Month {
  const complaints = closureStats(input.complaints)
  const realisation = computeRealisation(input.cells)
  const billing = computeBilling(input.billing)
  const rapor = computeRapor(input.rapor)

  const complaintEvidence = input.complaints.map((c) => c.source_message_id)

  return {
    figures: {
      complaintsRaised: figure(complaints.raised, complaintEvidence),
      complaintsAnswered: figure(complaints.answered, complaintEvidence),
      complaintsClosedWithPhoto: figure(complaints.closedWithPhoto, complaintEvidence),
      medianReplyMinutes: figure(complaints.medianReplyMinutes, complaintEvidence),
      medianClosureMinutes: figure(complaints.medianClosureMinutes, complaintEvidence),
      realisationGross: figure(realisation.gross, realisation.evidence),
      realisationNet: figure(realisation.net, realisation.evidence),
      blockedRows: figure(realisation.blocked, realisation.evidence),
      contractedSlotDays: figure(billing.contractedSlotDays, billing.evidence),
      unfilledSlotDays: figure(billing.unfilledSlotDays, billing.evidence),
      payable: figure(billing.payable, billing.evidence),
      raporTotal: figure(rapor.total, [...realisation.evidence, ...complaintEvidence]),
    },
  }
}
