import type { WorkReportRecord } from '@/contract/schemas'

/**
 * Report quality per person who files them.
 *
 * Reno-only, and deliberately not a ranking: the point is to find the one
 * team leader whose reports never name an area, not to order eight people
 * best to worst. A leader with four reports and one defect is not worse
 * than one with four hundred and ninety.
 *
 * See docs/specs/reno-dashboard.md (screen 6).
 */
export interface ReporterScore {
  readonly reporter: string
  readonly reports: number
  readonly clean: number
  readonly beforeAfter: number
  /** Share of this person's reports carrying no defect. */
  readonly passRate: number
}

export function scoreReporters(
  reports: readonly WorkReportRecord[],
): readonly ReporterScore[] {
  const byPerson = new Map<string, WorkReportRecord[]>()
  for (const report of reports) {
    const list = byPerson.get(report.sender_raw) ?? []
    list.push(report)
    byPerson.set(report.sender_raw, list)
  }

  return [...byPerson.entries()]
    .map(([reporter, own]) => {
      const clean = own.filter((r) => r.defects.length === 0).length
      return {
        reporter,
        reports: own.length,
        clean,
        beforeAfter: own.filter((r) => r.is_before_after).length,
        passRate: own.length === 0 ? 1 : clean / own.length,
      }
    })
    // Worst pass rate first: the reason to open this screen is to find it.
    .sort((a, b) => a.passRate - b.passRate || b.reports - a.reports)
}
