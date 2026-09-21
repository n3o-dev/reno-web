import { describe, expect, it } from 'vitest'
import { computeRapor, AUTO_FILLED, RAPOR_INDICATORS } from '@/rules/rapor'
import { applyOverride, effectiveValue } from '@/rules/override'
import { closureStats, elapsedExcludingBlocked } from '@/rules/clock'
import { computeRealisation } from '@/rules/realisation'
import { computeBilling } from '@/rules/billing'
import { computeMonth } from '@/rules/month'
import { sampleMonth } from '../support/month'

const inputs = Object.freeze(sampleMonth())

describe('AC-9 · the agent fills only what it can evidence', () => {
  const rapor = computeRapor(inputs.rapor)

  it('scores exactly A.1, A.3, C.3 and D.3', () => {
    const scored = RAPOR_INDICATORS.filter((i) => rapor.scores[i] !== null)
    // Compared to the literal the criterion names, not to the module's own
    // AUTO_FILLED constant — otherwise this is source checked against source.
    expect(scored.sort()).toEqual(['A.1', 'A.3', 'C.3', 'D.3'])
    expect([...AUTO_FILLED].sort()).toEqual(['A.1', 'A.3', 'C.3', 'D.3'])
  })

  it('leaves the other nine unscored rather than inventing a number', () => {
    const unscored = RAPOR_INDICATORS.filter((i) => rapor.scores[i] === null)
    expect(unscored).toHaveLength(9)
  })

  it('applies the SOP bands to the weighted total', () => {
    expect(['A', 'B', 'C']).toContain(rapor.predikat)
  })

  it('scores A.1 against net realisation, not gross', () => {
    const allBlocked = computeRapor({
      ...inputs.rapor,
      realisation: { ...inputs.rapor.realisation, gross: 0, net: 1 },
    })
    expect(allBlocked.scores['A.1']).toBe(5)
  })
})

describe('AC-10 · the total is provisional until every indicator is scored', () => {
  it('flags provisional while any indicator is null', () => {
    expect(computeRapor(inputs.rapor).provisional).toBe(true)
  })

  it('clears the flag only when all thirteen carry a score', () => {
    const manual = Object.fromEntries(RAPOR_INDICATORS.map((i) => [i, 4]))
    const complete = computeRapor({ ...inputs.rapor, manualScores: manual })
    expect(complete.provisional).toBe(false)
  })
})

describe('AC-11 · overrides are append-only and keep the original', () => {
  const base = { value: 3, evidence: ['msg_1'] }

  it('preserves the prior value and appends to the chain', () => {
    const once = applyOverride(base, {
      value: 4,
      reason: 'engineering confirmed the gondola never arrived',
      by: 'p_sahril',
      at: '2026-09-30T10:00:00+07:00',
    })
    const twice = applyOverride(once, {
      value: 5,
      reason: 'client agreed at the walk-through',
      by: 'p_alvin',
      at: '2026-09-30T14:00:00+07:00',
    })
    expect(twice.overrides).toHaveLength(2)
    expect(twice.value).toBe(3)
    expect(effectiveValue(twice)).toBe(5)
  })

  it('refuses an override with no written reason', () => {
    expect(() =>
      applyOverride(base, { value: 4, reason: '  ', by: 'p_sahril', at: '2026-09-30T10:00:00+07:00' }),
    ).toThrowError(/reason/i)
  })

  it('never mutates what it was given', () => {
    const frozen: typeof base = Object.freeze({ ...base })
    applyOverride(frozen, {
      value: 9,
      reason: 'because',
      by: 'p_x',
      at: '2026-09-30T10:00:00+07:00',
    })
    expect(frozen.value).toBe(3)
  })
})

describe('AC-1 · every exported rule is pure', () => {
  const calls: ReadonlyArray<readonly [string, () => unknown]> = [
    ['closureStats', () => closureStats(inputs.complaints)],
    [
      'elapsedExcludingBlocked',
      () =>
        elapsedExcludingBlocked({
          from: '2026-09-10T00:00:00+07:00',
          to: '2026-09-11T00:00:00+07:00',
          history: [],
        }),
    ],
    ['computeRealisation', () => computeRealisation(inputs.cells)],
    ['computeBilling', () => computeBilling(inputs.billing)],
    ['computeRapor', () => computeRapor(inputs.rapor)],
    ['computeMonth', () => computeMonth(inputs)],
    [
      'applyOverride',
      () =>
        applyOverride(
          { value: 3, evidence: ['msg_1'] },
          { value: 4, reason: 'because', by: 'p_x', at: '2026-09-30T10:00:00+07:00' },
        ),
    ],
    ['effectiveValue', () => effectiveValue({ value: 3, evidence: ['msg_1'] })],
  ]

  it.each(calls)('%s returns an identical result on a second call', (_name, call) => {
    expect(call()).toEqual(call())
  })

  it.each(calls)('%s reads no clock', (_name, call) => {
    const first = JSON.stringify(call())
    const realNow = Date.now
    Date.now = () => 0
    try {
      expect(JSON.stringify(call())).toBe(first)
    } finally {
      Date.now = realNow
    }
  })
})

describe('AC-12 · every figure carries its evidence', () => {
  it('fails on any figure with an empty evidence array', () => {
    const month = computeMonth(inputs)
    const bare = Object.entries(month.figures)
      .filter(([, figure]) => figure.evidence.length === 0)
      .map(([name]) => name)
    expect(bare).toEqual([])
  })

  it('cites message ids that resolve to a real message, not placeholders', () => {
    const month = computeMonth(inputs)
    const known = new Set([
      ...inputs.complaints.map((c) => c.source_message_id),
      ...inputs.cells.map((c) => c.source_message_id),
      ...inputs.billing.days.map((d) => d.source_message_id),
    ])
    for (const [name, figure] of Object.entries(month.figures)) {
      const unresolved = figure.evidence.filter((e) => !known.has(e))
      expect(unresolved, `${name} cites ids that match no message`).toEqual([])
    }
  })
})
