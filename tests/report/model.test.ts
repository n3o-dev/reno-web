import { describe, expect, it } from 'vitest'
import { readFile } from 'node:fs/promises'
import { createRecordSource, loadFixtureSource } from '@/contract/source'
import { parseWorkbook } from '@/rkb/read'
import { buildReportPack, type ReportPack } from '@/report/model'
import { getContract } from '@/services/contract'
import { daysInMonth } from '@/report/period'
import type { LineupRecord } from '@/contract/schemas'

/**
 * AC-2 — every figure in the pack stands on something.
 *
 * Walks the model rather than the rendered document: the report, the screens
 * and the workbook all render from this, so a figure with nothing behind it
 * is caught once instead of three times.
 */
const source = await loadFixtureSource()
const workbook = parseWorkbook(new Uint8Array(await readFile('fixtures/rkb/RKB_JULI_2026.xlsx')))
const contract = await getContract()

/*
 * The records and the workbook are from different months, and that is the
 * real situation: the group export covers 10-13 September, the only RKB we
 * hold is July's. A pack built for September therefore carries every record
 * figure and no realisation, and a pack built for July carries the plan and
 * no records. Both are tested, because the old code reported both at once by
 * ignoring the month entirely.
 */
const build = (month: string, over = contract): ReportPack =>
  buildReportPack({
    source,
    workbook,
    month,
    workbookLabel: 'RKB Juli 2026',
    siteId: 'lwas',
    siteLabel: 'Living World Alam Sutera',
    contract: over,
    workbookMonth: '2026-07',
  })

const pack: ReportPack = build('2026-09')
const july: ReportPack = build('2026-07')

describe('every section cites its sources', () => {
  it.each([
    ['rkb', pack.rkb.evidence],
    ['complaints', pack.complaints.evidence],
    ['work orders', pack.workOrders.evidence],
    ['manpower', pack.manpower.evidence],
    ['evidence gallery', pack.evidenceGallery.evidence],
  ])('%s', (_name, evidence) => {
    // Always at least one item — a citation or a stated reason there is
    // none. `total` may legitimately be 0: a section that cites nothing
    // must not report one source, which is the anti-pattern the evidence
    // gate exists to catch.
    expect(evidence.items.length).toBeGreaterThan(0)
    for (const item of evidence.items) {
      if (item.kind === 'absent') expect(evidence.total).toBe(0)
    }
    for (const item of evidence.items) {
      // Never an empty citation: a message, a workbook cell, or a stated
      // reason there is nothing to cite.
      if (item.kind === 'message') expect(item.messageId).not.toBe('')
      else if (item.kind === 'workbook') expect(item.sheet).not.toBe('')
      else expect(item.reason).not.toBe('')
    }
  })
})

describe('the figures match the rest of the system', () => {
  it('carries the deck complaint figures', () => {
    expect(pack.complaints.stats.raised).toBe(75)
    expect(pack.complaints.stats.answered).toBe(62)
    expect(pack.complaints.stats.closedWithPhoto).toBe(29)
    expect(pack.complaints.repeats).toHaveLength(7)
  })

  it('carries the workbook realisation for the month the workbook covers', () => {
    expect(july.rkb.coversThisMonth).toBe(true)
    expect(july.rkb.whole.planned).toBe(533)
    expect(july.rkb.sheets).toHaveLength(6)
  })

  it('reports no realisation for a month the loaded workbook is not for', () => {
    expect(pack.rkb.coversThisMonth).toBe(false)
    expect(pack.rkb.whole.planned).toBe(0)
    expect(pack.rkb.sheets).toEqual([])
    const [why] = pack.rkb.evidence.items
    expect(why?.kind).toBe('absent')
    if (why?.kind !== 'absent') throw new Error('expected a stated absence')
    expect(why.reason).toMatch(/covers 2026-07, not 2026-09/)
  })

  it('carries no record from outside the month', () => {
    expect(july.complaints.stats.raised).toBe(0)
    expect(july.workOrders.summary.total).toBe(0)
    expect(july.evidenceGallery.reportCount).toBe(0)
  })

  it('computes an amount, and marks it provisional while the headcount is assumed', () => {
    const { payable } = buildFull().manpower
    expect(payable.state).toBe('computed')
    if (payable.state !== 'computed') throw new Error('expected a computed figure')
    expect(payable.monthlyRatePerMp).toBe(5_000_000)
    expect(payable.currency).toBe('IDR')
    expect(payable.prorataDaysPerMonth).toBe(30)
    // The slot table is assumed from the line-ups, so nobody can invoice
    // from this yet and the figure has to say so.
    expect(payable.provisional).toBe(true)
  })

  it('stops being provisional once the table comes from the contract', () => {
    const fromContract = buildFull({ ...contract, slots_source: 'contract' })
    const { payable } = fromContract.manpower
    if (payable.state !== 'computed') throw new Error('expected a computed figure')
    expect(payable.provisional).toBe(false)
  })

  it('states no amount at all when there is no table', () => {
    const noTable = buildFull({ ...contract, slots: null })
    const { payable } = noTable.manpower
    expect(payable.state).toBe('incomplete')
    if (payable.state !== 'incomplete') throw new Error('expected an incomplete figure')
    expect(payable.monthlyRatePerMp).toBe(5_000_000)
    expect(payable.missing[0]).toMatch(/each area on each shift/)
  })

  it('counts every complaint exactly once across the cause split', () => {
    const { causes } = pack.complaints
    expect(causes.withinRenoControl + causes.outsideRenoControl).toBe(causes.total)
  })
})

describe('AC-3 · complaints never touch the billing figure', () => {
  it('produces the same manpower numbers with the complaints removed', () => {
    const withoutComplaints = buildReportPack({
      source: createRecordSource({
        message: [...source.messages],
        work_report: [...source.workReports],
        complaint: [],
        work_order: [...source.workOrders],
        lineup: [...source.lineups],
        rkb_match: [...source.rkbMatches],
        photo: [...source.photos],
        person: [...source.people],
      }),
      workbook,
      month: '2026-09',
      workbookLabel: 'RKB Juli 2026',
      siteId: 'lwas',
      siteLabel: 'Living World Alam Sutera',
      contract,
      workbookMonth: '2026-07',
    })
    expect(withoutComplaints.manpower.filledSlotDays).toBe(pack.manpower.filledSlotDays)
    expect(withoutComplaints.manpower.contractedSlotDays).toBe(pack.manpower.contractedSlotDays)
    expect(withoutComplaints.manpower.absences).toEqual(pack.manpower.absences)
    expect(withoutComplaints.complaints.stats.raised).toBe(0)
  })
})

describe('AC-8 · the sections a person fills say so', () => {
  it('names who fills each, and never renders as empty or zero', () => {
    expect(pack.humanSections).toHaveLength(3)
    for (const section of pack.humanSections) {
      expect(section.title).not.toBe('')
      expect(section.awaiting).not.toBe('')
      expect(section.awaiting).not.toMatch(/^0$/)
    }
  })
})

/*
 * The fixtures cover 10-13 September, so a September pack refuses to state
 * an amount: a month is invoiced in full and deducted from, and 26 days
 * nobody reported would otherwise be billed as covered. These tests need a
 * fully reported month, so the four days of real line-ups are repeated
 * across all thirty.
 */
const everyDay: LineupRecord[] = daysInMonth('2026-09').flatMap((date) =>
  ([1, 2] as const).map((shift) => {
    const template = source.lineups.find((l) => l.shift === shift)
    if (template === undefined) throw new Error(`no shift ${shift} line-up to copy`)
    return {
      ...template,
      record_id: `lu_${date}_${shift}`,
      date,
      sent_at: `${date}T0${shift === 1 ? 7 : 8}:00:00+07:00`,
    }
  }),
)

const fullMonth = createRecordSource({
  message: [...source.messages],
  work_report: [...source.workReports],
  complaint: [...source.complaints],
  work_order: [...source.workOrders],
  lineup: everyDay,
  rkb_match: [...source.rkbMatches],
  photo: [...source.photos],
  person: [...source.people],
})

const buildFull = (over = contract): ReportPack =>
  buildReportPack({
    source: fullMonth,
    workbook,
    month: '2026-09',
    workbookLabel: 'RKB Juli 2026',
    siteId: 'lwas',
    siteLabel: 'Living World Alam Sutera',
    contract: over,
    workbookMonth: '2026-07',
  })

describe('a month missing its line-ups is not invoiced', () => {
  it('names the days rather than billing them as covered', () => {
    const { payable } = pack.manpower
    expect(payable.state).toBe('incomplete')
    if (payable.state !== 'incomplete') throw new Error('expected an incomplete figure')
    expect(payable.missing[0]).toMatch(/26 of 30 days have no line-up/)
  })
})

describe('AC-4 · the payable figure, once the contract is known', () => {
  /* A slot table small enough to check by hand. */
  const AREAS = ['external', 'garbage', 'gf', 'gondola', 'lk', 'lt1', 'lt2', 'ug']
  const slots = [1 as const, 2 as const].flatMap((shift) =>
    AREAS.map((area_id) => ({ area_id, shift, contracted: area_id === 'gf' ? 4 : 1 })),
  )
  const withSlots = { ...contract, slots }

  const packed = buildFull(withSlots)

  it('multiplies the rate by the contracted headcount, not by the roster', () => {
    const { payable } = packed.manpower
    expect(payable.state).toBe('computed')
    if (payable.state !== 'computed') throw new Error('expected a computed figure')

    // 16 area-shifts: two at four people, fourteen at one. 22 at Rp5,000,000.
    expect(slots.reduce((n, s) => n + s.contracted, 0)).toBe(22)
    expect(payable.billing.gross).toBe(110_000_000)
    expect(payable.monthlyRatePerMp).toBe(5_000_000)
    expect(payable.prorataDaysPerMonth).toBe(30)
  })

  it('shows arithmetic that adds up', () => {
    const { payable } = packed.manpower
    if (payable.state !== 'computed') throw new Error('expected a computed figure')
    const { gross, deduction, payable: total } = payable.billing
    expect(gross - deduction).toBe(total)
  })

  it('deducts nothing when every slot was covered', () => {
    const { payable } = packed.manpower
    if (payable.state !== 'computed') throw new Error('expected a computed figure')
    // The line-ups list at least as many people as these slots require.
    expect(payable.billing.unfilledSlotDays).toBe(0)
    expect(payable.billing.deduction).toBe(0)
  })

  it('deducts a thirtieth of the monthly rate for each unfilled slot-day', () => {
    // Garbage is staffed by one person; require three and it runs short.
    const short = slots.map((s) =>
      s.area_id === 'garbage' ? { ...s, contracted: 3 } : s,
    )
    const shortStaffed = buildFull({ ...contract, slots: short })
    const { payable } = shortStaffed.manpower
    if (payable.state !== 'computed') throw new Error('expected a computed figure')

    // Two short on each of two shifts, over all thirty days: 120 slot-days,
    // each worth a thirtieth of Rp 5.000.000.
    expect(payable.billing.unfilledSlotDays).toBe(120)
    expect(payable.billing.deduction).toBe(20_000_000)
    expect(payable.billing.payable).toBe(payable.billing.gross - payable.billing.deduction)
  })
})

describe('a roster that strays outside the contract', () => {
  it('names the area-shifts nobody contracted rather than billing around them', () => {
    const partial = buildFull({ ...contract, slots: [{ area_id: 'gf', shift: 1, contracted: 8 }] })
    const { payable } = partial.manpower
    expect(payable.state).toBe('incomplete')
    if (payable.state !== 'incomplete') throw new Error('expected an incomplete figure')
    expect(payable.missing[0]).toMatch(/does not cover/)
    expect(payable.missing[0]).toMatch(/external:1/)
  })
})

describe('the pro-rata basis the pack prints is the one it used', () => {
  it('deducts on the contract divisor, not a constant', () => {
    const slots = [{ area_id: 'garbage', shift: 1 as const, contracted: 3 }]
    const areas = ['external', 'gf', 'ug', 'lt1', 'lt2', 'lk', 'gondola']
    const full = [
      ...slots,
      ...areas.flatMap((area_id) =>
        ([1, 2] as const).map((shift) => ({ area_id, shift, contracted: 1 })),
      ),
      { area_id: 'garbage', shift: 2 as const, contracted: 1 },
    ]

    const onThirty = buildFull({ ...contract, slots: full, prorata_days_per_month: 30 })
    const onTwentyTwo = buildFull({ ...contract, slots: full, prorata_days_per_month: 22 })

    const a = onThirty.manpower.payable
    const b = onTwentyTwo.manpower.payable
    if (a.state !== 'computed' || b.state !== 'computed') throw new Error('expected both computed')

    // Same shortfall, different basis, therefore a different deduction —
    // which is what makes the printed basis meaningful.
    expect(a.billing.unfilledSlotDays).toBe(b.billing.unfilledSlotDays)
    expect(a.billing.unfilledSlotDays).toBeGreaterThan(0)
    expect(b.billing.deduction).toBeGreaterThan(a.billing.deduction)
    expect(a.prorataDaysPerMonth).toBe(30)
    expect(b.prorataDaysPerMonth).toBe(22)
  })
})

describe('AC-10 · a correction moves every figure that depends on it', () => {
  /*
   * The defect this replaces: an override was applied while rendering, so
   * the number under the cursor changed and nothing else did. The per-area
   * figures summed to 295 while the headline read 296, and a correction
   * whose own reason said a slot went uncovered left the invoice untouched.
   */
  const correction = { slot_id: 'garbage:2', date: '2026-09-12', filled: 0 }

  const before = buildFull({ ...contract, slots_source: 'contract' })
  const after = buildReportPack({
    source: fullMonth,
    workbook,
    month: '2026-09',
    workbookLabel: 'RKB Juli 2026',
    siteId: 'lwas',
    siteLabel: 'Living World Alam Sutera',
    contract: { ...contract, slots_source: 'contract' },
    workbookMonth: '2026-07',
    corrections: [correction],
  })

  it('reduces the filled slot-days by exactly what was corrected', () => {
    expect(before.manpower.filledSlotDays - after.manpower.filledSlotDays).toBe(1)
  })

  it('keeps the per-area rows summing to the headline', () => {
    const summed = after.manpower.coverage.reduce((n, row) => n + row.filled, 0)
    expect(summed).toBe(after.manpower.filledSlotDays)
  })

  it('moves the amount payable, because an uncovered slot is a deduction', () => {
    const a = before.manpower.payable
    const b = after.manpower.payable
    if (a.state !== 'computed' || b.state !== 'computed') throw new Error('expected both computed')

    expect(b.billing.unfilledSlotDays).toBe(a.billing.unfilledSlotDays + 1)
    // One slot-day at a thirtieth of Rp 5.000.000.
    expect(b.billing.deduction - a.billing.deduction).toBe(Math.round(5_000_000 / 30))
    expect(b.billing.payable).toBeLessThan(a.billing.payable)
  })

  it('touches only the slot and day it names', () => {
    const untouched = after.manpower.coverage.filter((r) => r.area_id !== 'garbage')
    const same = before.manpower.coverage.filter((r) => r.area_id !== 'garbage')
    expect(untouched).toEqual(same)
  })
})

describe('a correction can raise a count, not only lower it', () => {
  /*
   * Truncating alone meant an override saying "there were more people than
   * the line-up listed" was a silent no-op that still printed its reason
   * beside an unchanged number. Observable on the deduction: coverage
   * clamps at the contracted headcount, so a raise only shows where the
   * contract asks for more than the line-up recorded.
   */
  const short = [
    { area_id: 'garbage', shift: 1 as const, contracted: 3 },
    ...['external', 'gf', 'ug', 'lt1', 'lt2', 'lk', 'gondola'].flatMap((area_id) =>
      ([1, 2] as const).map((shift) => ({ area_id, shift, contracted: 1 })),
    ),
    { area_id: 'garbage', shift: 2 as const, contracted: 1 },
  ]

  const buildShort = (corrections: { slot_id: string; date: string; filled: number }[]) =>
    buildReportPack({
      source: fullMonth,
      workbook,
      month: '2026-09',
      workbookLabel: 'RKB Juli 2026',
      siteId: 'lwas',
      siteLabel: 'Living World Alam Sutera',
      contract: { ...contract, slots_source: 'contract', slots: short },
      workbookMonth: '2026-07',
      corrections,
    })

  it('reduces the shortfall when someone confirms more people were there', () => {
    const base = buildShort([])
    const raised = buildShort([{ slot_id: 'garbage:1', date: '2026-09-12', filled: 3 }])

    const a = base.manpower.payable
    const b = raised.manpower.payable
    if (a.state !== 'computed' || b.state !== 'computed') throw new Error('expected computed')

    // One person listed against three required leaves two short that day;
    // correcting it to three closes both.
    expect(a.billing.unfilledSlotDays - b.billing.unfilledSlotDays).toBe(2)
    expect(b.billing.payable).toBeGreaterThan(a.billing.payable)
  })
})
