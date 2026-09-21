import type { Realisation } from './realisation'

/**
 * Rapor Pimpro — the SOP's weighted performance form.
 *
 * Only four of thirteen indicators can be evidenced from a WhatsApp group.
 * The rest return null and are labelled human input; a score is never invented
 * to complete the form, and the total reads provisional until it is complete.
 *
 * Pure. See docs/specs/billing-and-scoring-rules.md (AC-9, AC-10)
 */

export const RAPOR_INDICATORS = [
  'A.1', 'A.2', 'A.3', 'A.4',
  'B.1', 'B.2', 'B.3',
  'C.1', 'C.2', 'C.3',
  'D.1', 'D.2', 'D.3',
] as const
export type Indicator = (typeof RAPOR_INDICATORS)[number]

/** The only indicators the group can evidence. */
export const AUTO_FILLED: readonly Indicator[] = ['A.1', 'A.3', 'C.3', 'D.3']

const SECTION_WEIGHT = { A: 0.3, B: 0.2, C: 0.25, D: 0.25 } as const

export interface RaporInput {
  readonly realisation: Realisation
  readonly complaints: { readonly raised: number; readonly closedUnder24h: number; readonly repeatAreas: number; readonly clientIssuedSp: boolean }
  readonly attendance: { readonly unfilledSlotDays: number }
  readonly reports: { readonly total: number; readonly passed: number; readonly beforeAfter: number; readonly duplicatePhotos: number }
  readonly manualScores?: Readonly<Partial<Record<Indicator, number>>>
}

export interface Rapor {
  readonly scores: Readonly<Record<Indicator, number | null>>
  readonly sectionAverages: Readonly<Record<'A' | 'B' | 'C' | 'D', number | null>>
  readonly total: number
  readonly predikat: 'A' | 'B' | 'C'
  readonly provisional: boolean
}

/** SOP/OPS/001 A.1 — 5 at 100%, 3 below, 1 under 60%. Scored on net. */
function scoreRealisation(r: Realisation): number {
  const net = r.net
  if (net === null) return 3
  if (net >= 1) return 5
  if (net < 0.6) return 1
  return 3
}

/** SOP/OPS/001 A.3 — 5 at zero complaints or all closed under 24h. */
function scoreComplaints(c: RaporInput['complaints']): number {
  if (c.clientIssuedSp) return 1
  if (c.raised === 0) return 5
  if (c.closedUnder24h === c.raised && c.repeatAreas === 0) return 5
  return 3
}

function scoreDiscipline(a: RaporInput['attendance']): number {
  if (a.unfilledSlotDays === 0) return 5
  if (a.unfilledSlotDays <= 2) return 3
  return 1
}

/** SOP/OPS/001 D.3 — score 1 is reserved for fabricated data. */
function scoreReportQuality(r: RaporInput['reports']): number {
  if (r.duplicatePhotos > 0) return 1
  if (r.total === 0) return 3
  const passRate = r.passed / r.total
  const beforeAfterRate = r.beforeAfter / r.total
  return passRate >= 1 && beforeAfterRate >= 1 ? 5 : 3
}

export function computeRapor(input: RaporInput): Rapor {
  const manual = input.manualScores ?? {}
  const derived: Partial<Record<Indicator, number>> = {
    'A.1': scoreRealisation(input.realisation),
    'A.3': scoreComplaints(input.complaints),
    'C.3': scoreDiscipline(input.attendance),
    'D.3': scoreReportQuality(input.reports),
  }

  const entries = RAPOR_INDICATORS.map((i): readonly [Indicator, number | null] => {
    const value = manual[i] ?? derived[i] ?? null
    return [i, value]
  })
  const scores = Object.fromEntries(entries) as Record<Indicator, number | null>

  const sectionAverages = { A: 0, B: 0, C: 0, D: 0 } as Record<'A' | 'B' | 'C' | 'D', number | null>
  let total = 0
  for (const section of ['A', 'B', 'C', 'D'] as const) {
    const values = RAPOR_INDICATORS.filter((i) => i.startsWith(section))
      .map((i) => scores[i])
      .filter((v): v is number => v !== null)
    if (values.length === 0) {
      sectionAverages[section] = null
      continue
    }
    const average = values.reduce((a, b) => a + b, 0) / values.length
    sectionAverages[section] = average
    total += average * SECTION_WEIGHT[section]
  }

  const provisional = entries.some(([, value]) => value === null)
  const predikat = total >= 4.5 ? 'A' : total >= 3 ? 'B' : 'C'

  return { scores, sectionAverages, total, predikat, provisional }
}
