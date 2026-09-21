import { describe, expect, it } from 'vitest'
import { readFile } from 'node:fs/promises'
import { createRecordSource, loadFixtureSource } from '@/contract/source'
import { parseWorkbook } from '@/rkb/read'
import { buildReportPack, type ReportPack } from '@/report/model'
import { getContract } from '@/services/contract'

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

const pack: ReportPack = buildReportPack({
  source,
  workbook,
  month: '2026-07',
  workbookLabel: 'RKB Juli 2026',
  siteId: 'lwas',
  siteLabel: 'Living World Alam Sutera',
  contract,
})

describe('every section cites its sources', () => {
  it.each([
    ['rkb', pack.rkb.evidence],
    ['complaints', pack.complaints.evidence],
    ['work orders', pack.workOrders.evidence],
    ['manpower', pack.manpower.evidence],
    ['evidence gallery', pack.evidenceGallery.evidence],
  ])('%s', (_name, evidence) => {
    expect(evidence.total).toBeGreaterThan(0)
    expect(evidence.items.length).toBeGreaterThan(0)
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

  it('carries the workbook realisation', () => {
    expect(pack.rkb.whole.planned).toBe(533)
    expect(pack.rkb.sheets).toHaveLength(6)
  })

  it('computes an amount, and marks it provisional while the headcount is assumed', () => {
    const { payable } = pack.manpower
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
    const fromContract = buildReportPack({
      source,
      workbook,
      month: '2026-07',
      workbookLabel: 'RKB Juli 2026',
      siteId: 'lwas',
      siteLabel: 'Living World Alam Sutera',
      contract: { ...contract, slots_source: 'contract' },
    })
    const { payable } = fromContract.manpower
    if (payable.state !== 'computed') throw new Error('expected a computed figure')
    expect(payable.provisional).toBe(false)
  })

  it('states no amount at all when there is no table', () => {
    const noTable = buildReportPack({
      source,
      workbook,
      month: '2026-07',
      workbookLabel: 'RKB Juli 2026',
      siteId: 'lwas',
      siteLabel: 'Living World Alam Sutera',
      contract: { ...contract, slots: null },
    })
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
      month: '2026-07',
      workbookLabel: 'RKB Juli 2026',
      siteId: 'lwas',
      siteLabel: 'Living World Alam Sutera',
      contract,
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

describe('AC-4 · the payable figure, once the contract is known', () => {
  /*
   * A slot table small enough to check by hand: two areas on one shift,
   * six people in total. Over four days that is 24 contracted slot-days.
   */
  const AREAS = ['external', 'garbage', 'gf', 'gondola', 'lk', 'lt1', 'lt2', 'ug']
  const slots = [1 as const, 2 as const].flatMap((shift) =>
    AREAS.map((area_id) => ({ area_id, shift, contracted: area_id === 'gf' ? 4 : 1 })),
  )
  const withSlots = { ...contract, slots }

  const packed = buildReportPack({
    source,
    workbook,
    month: '2026-07',
    workbookLabel: 'RKB Juli 2026',
    siteId: 'lwas',
    siteLabel: 'Living World Alam Sutera',
    contract: withSlots,
  })

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
    const shortStaffed = buildReportPack({
      source,
      workbook,
      month: '2026-07',
      workbookLabel: 'RKB Juli 2026',
      siteId: 'lwas',
      siteLabel: 'Living World Alam Sutera',
      contract: { ...contract, slots: short },
    })
    const { payable } = shortStaffed.manpower
    if (payable.state !== 'computed') throw new Error('expected a computed figure')

    // Two short on each of two shifts, over four days: 16 slot-days.
    expect(payable.billing.unfilledSlotDays).toBe(16)
    expect(payable.billing.deduction).toBe(Math.round((16 * 5_000_000) / 30))
    expect(payable.billing.payable).toBe(payable.billing.gross - payable.billing.deduction)
  })
})

describe('a roster that strays outside the contract', () => {
  it('names the area-shifts nobody contracted rather than billing around them', () => {
    const partial = buildReportPack({
      source,
      workbook,
      month: '2026-07',
      workbookLabel: 'RKB Juli 2026',
      siteId: 'lwas',
      siteLabel: 'Living World Alam Sutera',
      contract: { ...contract, slots: [{ area_id: 'gf', shift: 1, contracted: 8 }] },
    })
    const { payable } = partial.manpower
    expect(payable.state).toBe('incomplete')
    if (payable.state !== 'incomplete') throw new Error('expected an incomplete figure')
    expect(payable.missing[0]).toMatch(/does not cover/)
    expect(payable.missing[0]).toMatch(/external:1/)
  })
})
