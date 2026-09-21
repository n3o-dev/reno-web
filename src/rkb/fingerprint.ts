import type { Workbook } from './read'

/**
 * The plan is frozen for the month (ADR-0004).
 *
 * Job rows are identified by where they sit — sheet, section, `NO` — so an
 * insert, a delete or a reorder silently re-points every match after it. The
 * chosen answer was to freeze the plan rather than build a new identity
 * scheme, and a freeze nobody checks is not a freeze: this fingerprints the
 * structure and refuses an upload that moved anything.
 *
 * Wording is deliberately not part of the fingerprint. Renaming an activity
 * is the edit Reno makes most often and it breaks nothing.
 *
 * See docs/specs/reno-dashboard.md (AC-16).
 */
export interface JobRowPosition {
  readonly sheet: string
  readonly section: string
  readonly no: number
}

export interface PlanFingerprint {
  readonly rows: readonly JobRowPosition[]
}

const key = (row: JobRowPosition): string => `${row.sheet.trim()} › ${row.section} › ${row.no}`

export function fingerprintPlan(book: Workbook): PlanFingerprint {
  const rows: JobRowPosition[] = []
  for (const sheet of book.sheets) {
    for (const section of sheet.sections) {
      for (const row of section.rows) {
        rows.push({ sheet: sheet.name, section: section.name, no: row.no })
      }
    }
  }
  return { rows }
}

export interface PlanChange {
  readonly added: readonly string[]
  readonly removed: readonly string[]
  readonly reordered: boolean
}

export function comparePlans(current: PlanFingerprint, incoming: PlanFingerprint): PlanChange {
  const before = current.rows.map(key)
  const after = incoming.rows.map(key)
  const beforeSet = new Set(before)
  const afterSet = new Set(after)

  return {
    added: after.filter((k) => !beforeSet.has(k)),
    removed: before.filter((k) => !afterSet.has(k)),
    // Only meaningful when the two hold the same rows; an add or a remove
    // shifts order by definition and is already reported as itself.
    reordered:
      before.length === after.length &&
      before.every((k) => afterSet.has(k)) &&
      before.some((k, i) => k !== after[i]),
  }
}

export class PlanFrozenError extends Error {
  constructor(readonly change: PlanChange) {
    super(describe(change))
    this.name = 'PlanFrozenError'
  }
}

function describe(change: PlanChange): string {
  const parts: string[] = []
  if (change.added.length > 0) parts.push(`added ${change.added.join(', ')}`)
  if (change.removed.length > 0) parts.push(`removed ${change.removed.join(', ')}`)
  if (change.reordered) parts.push('reordered its job rows')
  return `the plan is frozen for the month: this workbook ${parts.join('; ')}. Upload it at the start of next month, or restore the rows and upload again.`
}

/**
 * Accepts an upload, or refuses it naming what moved.
 *
 * Returns nothing on success: the caller has the workbook already, and a
 * boolean return invites ignoring it.
 */
export function assertPlanUnchanged(current: Workbook, incoming: Workbook): void {
  const change = comparePlans(fingerprintPlan(current), fingerprintPlan(incoming))
  if (change.added.length > 0 || change.removed.length > 0 || change.reordered) {
    throw new PlanFrozenError(change)
  }
}
