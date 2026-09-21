import type { RecordSource } from '@/contract/source'
import type { Workbook } from '@/rkb/read'
import { closureStats, type ClosureStats } from '@/rules/clock'
import { causeSplit, repeatAreas, type CauseSplit, type RepeatArea } from '@/rules/causes'
import { countByDay, type DayCount } from '@/rules/daily'
import type { SlotDay } from '@/rules/billing'
import {
  absenceTotals,
  coverage,
  provisionalContracts,
  slotDays,
  type AbsenceTotals,
  type Coverage,
} from '@/rules/manpower'
import { countBeforeAfter, findDuplicatePhotos, validationPassRate } from '@/rules/quality'
import { computeRealisation, type Realisation } from '@/rules/realisation'
import { deliveryOf, summariseDeliveries, type Delivery, type DeliverySummary } from '@/rules/work-orders'
import { planCells, sheetSlug, workbookEvidence } from '@/services/rkb'
import { bundleEvidence, type FigureEvidence } from '@/services/evidence'
import { computeBilling, type Billing } from '@/rules/billing'
import { contractSlots, type SiteContract } from '@/services/contract'

/**
 * Everything the monthly pack says, computed once.
 *
 * The three artefacts — the RKB workbook, the client report, the BAPP pack —
 * all render from this rather than each recomputing. That is what stops the
 * pack and the screens disagreeing about a number, and it makes "every
 * figure traces to a message" one walk over a structure instead of a hunt
 * through a PDF.
 *
 * See docs/specs/monthly-report-pack.md
 */

export interface ReportPeriod {
  /** `YYYY-MM`. */
  readonly month: string
  readonly label: string
  readonly days: readonly string[]
}

export interface SheetRealisation {
  readonly name: string
  readonly slug: string
  readonly realisation: Realisation
}

/**
 * What the client owes, or precisely what is missing before it can be said.
 *
 * Two inputs, and only one is known: the rate per person per month, and how
 * many people the contract requires. A figure built on a headcount derived
 * from the roster would be wrong by the number of shifts, so the pack names
 * what it is waiting for rather than guessing.
 */
export type Payable =
  | {
      readonly state: 'computed'
      readonly billing: Billing
      readonly currency: string
      readonly monthlyRatePerMp: number
      readonly prorataDaysPerMonth: number
    }
  | {
      readonly state: 'incomplete'
      readonly currency: string
      readonly monthlyRatePerMp: number | null
      /** In words, each naming the thing to supply. */
      readonly missing: readonly string[]
    }

export interface HumanSection {
  readonly title: string
  /** Who fills it, in words. Never blank, never zero. */
  readonly awaiting: string
}

export interface ReportPack {
  readonly period: ReportPeriod
  readonly site: { readonly id: string; readonly label: string }

  readonly rkb: {
    readonly workbook: string
    readonly whole: Realisation
    readonly sheets: readonly SheetRealisation[]
    readonly evidence: FigureEvidence
  }

  readonly complaints: {
    readonly stats: ClosureStats
    readonly causes: CauseSplit
    readonly repeats: readonly RepeatArea[]
    readonly perDay: readonly DayCount[]
    readonly blocked: number
    readonly evidence: FigureEvidence
  }

  readonly workOrders: {
    readonly summary: DeliverySummary
    readonly deliveries: readonly Delivery[]
    readonly evidence: FigureEvidence
  }

  readonly manpower: {
    readonly coverage: readonly Coverage[]
    readonly absences: AbsenceTotals
    readonly filledSlotDays: number
    readonly contractedSlotDays: number
    readonly evidence: FigureEvidence
    readonly payable: Payable
  }

  readonly evidenceGallery: {
    readonly beforeAfter: number
    readonly reportCount: number
    readonly passRate: number
    readonly duplicatePairs: number
    readonly evidence: FigureEvidence
  }

  readonly humanSections: readonly HumanSection[]
}

export interface BuildInput {
  readonly source: RecordSource
  readonly workbook: Workbook
  readonly month: string
  readonly workbookLabel: string
  readonly siteId: string
  readonly siteLabel: string
  readonly contract: SiteContract
}

function computePayable(input: BuildInput, days: readonly SlotDay[]): Payable {
  const { contract } = input
  const slots = contractSlots(contract)
  if (slots === null) {
    return {
      state: 'incomplete',
      currency: contract.currency,
      monthlyRatePerMp: contract.monthly_rate_per_mp,
      missing: [
        'How many people the contract requires in each area on each shift. The roster cannot stand in for it: the same people appear on more than one shift, so a headcount derived from it counts them twice.',
      ],
    }
  }

  /*
   * Every slot the roster shows has to be in the contract. A line-up naming
   * an area nobody contracted means either the table is incomplete or people
   * are working somewhere unbilled, and both need a person — so the pack
   * names the areas rather than quietly billing the ones it recognises.
   */
  const contracted = new Set(slots.map((slot) => slot.slot_id))
  const uncontracted = [...new Set(days.map((d) => d.slot_id))]
    .filter((id) => !contracted.has(id))
    .sort()
  if (uncontracted.length > 0) {
    return {
      state: 'incomplete',
      currency: contract.currency,
      monthlyRatePerMp: contract.monthly_rate_per_mp,
      missing: [
        `The roster lists ${uncontracted.length} area-shift(s) the contract does not cover: ${uncontracted.join(', ')}. Either the slot table is incomplete or people are working somewhere unbilled.`,
      ],
    }
  }

  return {
    state: 'computed',
    billing: computeBilling({
      contracts: slots,
      days,
      monthlyRatePerMp: contract.monthly_rate_per_mp,
    }),
    currency: contract.currency,
    monthlyRatePerMp: contract.monthly_rate_per_mp,
    prorataDaysPerMonth: contract.prorata_days_per_month,
  }
}

const MONTH_LABEL = new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric' })

export function buildReportPack(input: BuildInput): ReportPack {
  const { source, workbook, month } = input
  const complaints = source.complaints
  const reports = source.workReports
  const lineups = source.lineups

  const contracts = provisionalContracts(lineups)
  const days = slotDays(lineups)
  const rows = coverage(contracts, days)

  const sheets = workbook.sheets.map((sheet) => ({
    name: sheet.name.trim(),
    slug: sheetSlug(sheet.name),
    realisation: computeRealisation(planCells(sheet, month)),
  }))

  return {
    period: {
      month,
      label: MONTH_LABEL.format(new Date(`${month}-01T00:00:00Z`)),
      days: countByDay(source.messages).map((d) => d.date),
    },
    site: { id: input.siteId, label: input.siteLabel },

    rkb: {
      workbook: input.workbookLabel,
      whole: computeRealisation(workbook.sheets.flatMap((sheet) => planCells(sheet, month))),
      sheets,
      evidence: {
        items: workbook.sheets.map((sheet) =>
          workbookEvidence(
            sheet.name,
            sheet.sections.flatMap((s) => s.rows.map((r) => r.rowNumber)),
          ),
        ),
        total: workbook.sheets.length,
      },
    },

    complaints: {
      stats: closureStats(complaints),
      causes: causeSplit(complaints),
      repeats: repeatAreas(complaints),
      perDay: countByDay(complaints),
      blocked: complaints.filter((c) => c.state === 'blocked').length,
      evidence: bundleEvidence(
        source,
        complaints.map((c) => c.source_message_id),
        'No complaint was raised in this period.',
      ),
    },

    workOrders: {
      summary: summariseDeliveries(source.workOrders),
      deliveries: [...source.workOrders]
        .sort((a, b) => a.due_date.localeCompare(b.due_date))
        .map(deliveryOf),
      evidence: bundleEvidence(
        source,
        source.workOrders.map((w) => w.source_message_id),
        'The client raised no work order in this period.',
      ),
    },

    manpower: {
      coverage: rows,
      absences: absenceTotals(lineups),
      filledSlotDays: rows.reduce((n, r) => n + r.filled, 0),
      contractedSlotDays: rows.reduce((n, r) => n + r.contractedSlotDays, 0),
      evidence: bundleEvidence(
        source,
        lineups.map((l) => l.source_message_id),
        'No line-up was posted in this period.',
      ),
      payable: computePayable(input, days),
    },

    evidenceGallery: {
      beforeAfter: countBeforeAfter(reports),
      reportCount: reports.length,
      passRate: validationPassRate(reports),
      duplicatePairs: findDuplicatePhotos(source.photos).length,
      evidence: bundleEvidence(
        source,
        reports.filter((r) => r.is_before_after).map((r) => r.source_message_id),
        'No report in this period carried before and after.',
      ),
    },

    humanSections: [
      { title: 'Training completed', awaiting: 'Attached from Renno Grow Hub by a person' },
      { title: 'Action plan', awaiting: 'Written by the Project Coordinator' },
      { title: 'Client sign-off', awaiting: 'Confirmed in the site WhatsApp group' },
    ],
  }
}
