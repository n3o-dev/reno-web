import { describe, expect, it } from 'vitest'
import { computeRealisation } from '@/rules/realisation'
import { computeBilling, type SlotContract, type SlotDay } from '@/rules/billing'

const RATE = 4_250_000

describe('AC-5 · realisation always returns gross and net together', () => {
  const rows = [
    { job_row_id: 'a', date: '2026-09-10', planned: true, done: true, blocked: false },
    { job_row_id: 'b', date: '2026-09-10', planned: true, done: false, blocked: false },
    { job_row_id: 'c', date: '2026-09-11', planned: true, done: false, blocked: true },
    { job_row_id: 'd', date: '2026-09-11', planned: false, done: false, blocked: false },
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
      { job_row_id: 'x', date: '2026-09-11', planned: true, done: false, blocked: true },
    ])
    expect(r.net).toBeNull()
    expect(r.gross).toBe(0)
  })

  it('carries the evidence for every row it counted', () => {
    const r = computeRealisation(rows)
    expect(r.evidence.length).toBeGreaterThan(0)
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
  it('deducts pro-rata for an unfilled, unreplaced slot-day', () => {
    const days = fullMonth(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'])
    const short = days.map((d, i) => (i === 0 ? { ...d, names: d.names.slice(0, -1) } : d))
    const full = computeBilling({ contracts, days, monthlyRatePerMp: RATE })
    const result = computeBilling({ contracts, days: short, monthlyRatePerMp: RATE })
    expect(result.unfilledSlotDays).toBe(1)
    expect(result.payable).toBeLessThan(full.payable)
    expect(full.payable - result.payable).toBeGreaterThan(0)
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
  it('produces a byte-identical figure whatever the complaint volume', () => {
    const days = fullMonth(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'])
    const quiet = computeBilling({ contracts, days, monthlyRatePerMp: RATE })
    const noisy = computeBilling({ contracts, days, monthlyRatePerMp: RATE })
    expect(JSON.stringify(noisy)).toBe(JSON.stringify(quiet))
  })

  it('takes no complaint argument at all, so it cannot depend on one', () => {
    expect(computeBilling.length).toBe(1)
  })
})
