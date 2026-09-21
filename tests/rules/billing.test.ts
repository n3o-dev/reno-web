import { describe, expect, it } from 'vitest'
import { computeRealisation } from '@/rules/realisation'
import { computeBilling, type SlotContract, type SlotDay } from '@/rules/billing'
import { computeMonth } from '@/rules/month'
import { sampleMonth, noisyComplaint } from '../support/month'

const RATE = 4_250_000

describe('AC-5 · realisation always returns gross and net together', () => {
  const rows = [
    { job_row_id: 'a', date: '2026-09-10', planned: true, done: true, blocked: false, source_message_id: 'msg_a' },
    { job_row_id: 'b', date: '2026-09-10', planned: true, done: false, blocked: false, source_message_id: null },
    { job_row_id: 'c', date: '2026-09-11', planned: true, done: false, blocked: true, source_message_id: 'msg_c' },
    { job_row_id: 'd', date: '2026-09-11', planned: false, done: false, blocked: false, source_message_id: null },
  ]

  it('exposes both keys on every call', () => {
    const r = computeRealisation(rows)
    expect(Object.keys(r)).toEqual(expect.arrayContaining(['gross', 'net']))
    expect(r.gross).not.toBeUndefined()
    expect(r.net).not.toBeUndefined()
  })

  it('counts blocked rows against gross but not against net', () => {
    const r = computeRealisation(rows)
    expect(r.planned).toBe(3)
    expect(r.done).toBe(1)
    expect(r.blocked).toBe(1)
    expect(r.gross).toBeCloseTo(1 / 3)
    expect(r.net).toBeCloseTo(1 / 2)
  })

  it('does not divide by zero when every planned row is blocked', () => {
    const r = computeRealisation([
      { job_row_id: 'x', date: '2026-09-11', planned: true, done: false, blocked: true, source_message_id: 'msg_x' },
    ])
    expect(r.net).toBeNull()
    expect(r.gross).toBe(0)
  })

  /**
   * Pinned while the spec decision on AC-12 is open: a planned cell that was
   * never reported has no message to cite, so evidence is empty. This must not
   * silently become "the nearest message id" — that would be a fabrication.
   */
  it('returns empty evidence rather than inventing a citation when nothing was reported', () => {
    const r = computeRealisation([
      { job_row_id: 'a', date: '2026-09-10', planned: true, done: false, blocked: false, source_message_id: null },
      { job_row_id: 'b', date: '2026-09-11', planned: true, done: false, blocked: false, source_message_id: null },
    ])
    expect(r.evidence).toEqual([])
    expect(r.planned).toBe(2)
    expect(r.gross).toBe(0)
  })

  it('carries message ids as evidence, never synthetic keys', () => {
    const r = computeRealisation(rows)
    expect(r.evidence).toEqual(['msg_a', 'msg_c'])
    expect(r.evidence.every((e) => e.startsWith('msg_'))).toBe(true)
  })
})

const contracts: SlotContract[] = [
  { slot_id: 'external_s1', area_id: 'external', shift: 1, contracted: 6 },
  { slot_id: 'gf_s1', area_id: 'gf', shift: 1, contracted: 8 },
]

function fullMonth(names: string[]): SlotDay[] {
  return contracts.flatMap((c) =>
    ['2026-09-10', '2026-09-11'].map((date) => ({
      slot_id: c.slot_id,
      date,
      names: names.slice(0, c.contracted),
      absences: [],
      source_message_id: `msg_lineup_${c.slot_id}_${date}`,
    })),
  )
}

describe('AC-6 · a covered slot bills in full whoever fills it', () => {
  const roster = ['Renno', 'Sandi', 'Nando', 'Ade', 'Okta', 'Marhadi', 'Ani', 'Deviana']

  it('is unchanged when every name is swapped but the headcount holds', () => {
    const a = computeBilling({ contracts, days: fullMonth(roster), monthlyRatePerMp: RATE })
    const swapped = roster.map((_, i) => `Replacement ${i}`)
    const b = computeBilling({ contracts, days: fullMonth(swapped), monthlyRatePerMp: RATE })
    expect(b.payable).toBe(a.payable)
    expect(b.unfilledSlotDays).toBe(a.unfilledSlotDays)
  })
})

describe('AC-7 · deductions', () => {
  it('deducts exactly one thirtieth of the monthly rate per unfilled slot-day', () => {
    const days = fullMonth(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'])
    const short = days.map((d, i) => (i === 0 ? { ...d, names: d.names.slice(0, -1) } : d))
    const full = computeBilling({ contracts, days, monthlyRatePerMp: RATE })
    const result = computeBilling({ contracts, days: short, monthlyRatePerMp: RATE })

    const oneSlotDay = Math.round(RATE / 30)
    expect(result.unfilledSlotDays).toBe(1)
    expect(full.deduction).toBe(0)
    expect(result.deduction).toBe(oneSlotDay)
    expect(full.payable - result.payable).toBe(oneSlotDay)
  })

  it('scales the deduction linearly with the number of unfilled slot-days', () => {
    const days = fullMonth(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'])
    const shortBy3 = days.map((d, i) => (i === 0 ? { ...d, names: d.names.slice(0, -3) } : d))
    const result = computeBilling({ contracts, days: shortBy3, monthlyRatePerMp: RATE })
    expect(result.unfilledSlotDays).toBe(3)
    expect(result.deduction).toBe(Math.round(3 * (RATE / 30)))
  })

  it('never deducts for an off day', () => {
    const days = fullMonth(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'])
    const withOff = days.map((d, i) =>
      i === 0
        ? { ...d, names: d.names.slice(0, -1), absences: [{ reason: 'off_day' as const, count: 1 }] }
        : d,
    )
    const full = computeBilling({ contracts, days, monthlyRatePerMp: RATE })
    const result = computeBilling({ contracts, days: withOff, monthlyRatePerMp: RATE })
    expect(result.payable).toBe(full.payable)
    expect(result.unfilledSlotDays).toBe(0)
  })

  it('deducts for sakit, izin and alfa when the slot went unfilled', () => {
    for (const reason of ['sakit', 'izin', 'alfa'] as const) {
      const days = fullMonth(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'])
      const short = days.map((d, i) =>
        i === 0 ? { ...d, names: d.names.slice(0, -1), absences: [{ reason, count: 1 }] } : d,
      )
      const result = computeBilling({ contracts, days: short, monthlyRatePerMp: RATE })
      expect(result.unfilledSlotDays, reason).toBe(1)
    }
  })
})

describe('AC-8 · complaints never touch the invoice', () => {
  const days = fullMonth(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'])

  it('produces an identical figure for a quiet month and a month with 40 complaints', () => {
    const quiet = computeMonth({ ...sampleMonth(), billing: { contracts, days, monthlyRatePerMp: RATE } })
    const fortyMore = [
      ...sampleMonth().complaints,
      ...Array.from({ length: 40 }, (_, n) => noisyComplaint(n)),
    ]
    const noisy = computeMonth({
      ...sampleMonth(),
      complaints: fortyMore,
      billing: { contracts, days, monthlyRatePerMp: RATE },
    })

    // The complaint figures must actually differ, or this proves nothing.
    expect(noisy.figures.complaintsRaised?.value).toBe(43)
    expect(quiet.figures.complaintsRaised?.value).toBe(3)

    expect(noisy.figures.payable?.value).toBe(quiet.figures.payable?.value)
    expect(noisy.figures.unfilledSlotDays?.value).toBe(quiet.figures.unfilledSlotDays?.value)
  })
})
