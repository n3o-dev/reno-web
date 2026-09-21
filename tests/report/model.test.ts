import { describe, expect, it } from 'vitest'
import { readFile } from 'node:fs/promises'
import { createRecordSource, loadFixtureSource } from '@/contract/source'
import { parseWorkbook } from '@/rkb/read'
import { buildReportPack, type ReportPack } from '@/report/model'

/**
 * AC-2 — every figure in the pack stands on something.
 *
 * Walks the model rather than the rendered document: the report, the screens
 * and the workbook all render from this, so a figure with nothing behind it
 * is caught once instead of three times.
 */
const source = await loadFixtureSource()
const workbook = parseWorkbook(new Uint8Array(await readFile('fixtures/rkb/RKB_JULI_2026.xlsx')))

const pack: ReportPack = buildReportPack({
  source,
  workbook,
  month: '2026-07',
  workbookLabel: 'RKB Juli 2026',
  siteId: 'lwas',
  siteLabel: 'Living World Alam Sutera',
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

  it('states no money while the contract rate is unknown', () => {
    expect(pack.manpower.payable).toBeNull()
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
