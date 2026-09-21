import { RkbWriteError } from './write-error'
import { findCell, setCellValue, columnToIndex, indexToColumn } from './cell'

/**
 * Refreshing the JUMLAH / REALISASI / PERSENTASI rows.
 *
 * These are Reno's own formulas with cached results. The formulas are never
 * rewritten — only their cached values are refreshed, so a reader that does
 * not recalculate still sees the truth and Excel still recalculates on open
 * exactly as before.
 *
 * See docs/specs/rkb-workbook-io.md (AC-7)
 */

export interface TotalsRows {
  readonly jumlah: number | null
  readonly realisasi: number | null
  readonly persentasi: number | null
}

export interface StaleTotal {
  /** Koridor dalam and Toilet share totals rows, so column+row alone is ambiguous. */
  readonly sheet: string
  readonly column: string
  /** The row that actually holds the literal, not always the JUMLAH row. */
  readonly row: number
  readonly reason: string
}

export interface TotalsTarget {
  readonly sheet: string
  /** The column the totals cells sit in — the day's R column, not its A column. */
  readonly column: string
  readonly rows: TotalsRows
}

/** Numeric values by cell reference, for evaluating a SUM range. */
export function valueMap(xml: string): Map<string, number> {
  const out = new Map<string, number>()
  // Self-closing cells must be matched explicitly: `[^>]*?` happily consumes
  // the `/` of `<c r="M12" s="132"/>`, and the pair form then swallows every
  // cell up to the next `</c>`.
  for (const cell of xml.matchAll(/<c ([^>]*?)(?:\/>|>(.*?)<\/c>)/g)) {
    const attrs = cell[1] ?? ''
    const inner = cell[2] ?? ''
    const ref = /r="([A-Z]+\d+)"/.exec(attrs)?.[1]
    if (ref === undefined) continue
    if (/\st="(s|e|str)"/.test(attrs)) continue
    const raw = /<v>(.*?)<\/v>/.exec(inner)?.[1]
    if (raw === undefined) continue
    const n = Number(raw)
    if (Number.isFinite(n)) out.set(ref, n)
  }
  return out
}

/**
 * Evaluates `SUM(E11:E16)`, including the multi-column form. Throws rather
 * than guessing: the spec says fail loudly on a workbook we do not understand,
 * and a silently unrefreshed total is worse than a refusal.
 */
export function evaluateSum(
  formula: string,
  values: ReadonlyMap<string, number>,
  where: string,
): number {
  const range = /^SUM\(([A-Z]+)(\d+):([A-Z]+)(\d+)\)$/.exec(formula.trim())
  if (range === null) {
    throw new RkbWriteError(
      `cannot refresh ${where}: "${formula}" is not a SUM range this writer understands`,
    )
  }
  const [, fromCol, fromRow, toCol, toRow] = range
  if (fromCol === undefined || fromRow === undefined || toCol === undefined || toRow === undefined) {
    throw new RkbWriteError(`cannot refresh ${where}: malformed range in "${formula}"`)
  }
  let total = 0
  for (let c = columnToIndex(fromCol); c <= columnToIndex(toCol); c++) {
    for (let r = Number(fromRow); r <= Number(toRow); r++) {
      total += values.get(`${indexToColumn(c)}${r}`) ?? 0
    }
  }
  return total
}

const formulaOf = (xml: string, ref: string): string | null =>
  /<f>(.*?)<\/f>/.exec(findCell(xml, ref)?.text ?? '')?.[1] ?? null

export interface RefreshResult {
  readonly xml: string
  /** Totals left untouched because the workbook states them as literals. */
  readonly stale: readonly StaleTotal[]
}

export function refreshTotals(
  xml: string,
  targets: readonly TotalsTarget[],
): RefreshResult {
  let out = xml
  const stale: StaleTotal[] = []
  const seen = new Set<string>()

  for (const target of targets) {
    const { jumlah, realisasi, persentasi } = target.rows
    if (jumlah === null || realisasi === null || persentasi === null) continue
    const key = `${target.column}:${jumlah}`
    if (seen.has(key)) continue
    seen.add(key)

    const values = valueMap(out)
    const jRef = `${target.column}${jumlah}`
    const rRef = `${target.column}${realisasi}`
    const pRef = `${target.column}${persentasi}`

    const jFormula = formulaOf(out, jRef)
    const rFormula = formulaOf(out, rRef)
    /**
     * Reno states some totals as literals rather than formulas — Ruang Utility
     * days 1 and 2 are typed by hand. There is no range to tell us what to sum,
     * so the literal is authoritative and is left alone. Refusing the write
     * instead would be worse: the A value would never land at all, and one such
     * cell would take a whole month's export with it. The caller is told.
     */
    if (jFormula === null || rFormula === null) {
      const reason = 'the workbook states this total as a literal, not a formula'
      if (jFormula === null) {
        stale.push({ sheet: target.sheet, column: target.column, row: jumlah, reason })
      }
      if (rFormula === null) {
        stale.push({ sheet: target.sheet, column: target.column, row: realisasi, reason })
      }
      continue
    }
    const jValue = evaluateSum(jFormula, values, jRef)
    const rValue = evaluateSum(rFormula, values, rRef)

    /**
     * The percentage formula is read, not assumed: caching a number that
     * disagrees with the formula beside it is the worst shape of wrong.
     */
    const pFormula = formulaOf(out, pRef)
    const expected = new RegExp(`^${rRef}/${jRef}\\*100%$`)
    if (pFormula === null || !expected.test(pFormula.trim())) {
      throw new RkbWriteError(
        `cannot refresh ${pRef}: expected "${rRef}/${jRef}*100%" but found "${pFormula ?? 'no formula'}"`,
      )
    }

    out = setCellValue(out, jRef, String(jValue), false)
    out = setCellValue(out, rRef, String(rValue), false)

    /**
     * A zero denominator stays #DIV/0!. Replacing it with 0 would read as
     * "nothing was done" when the truth is "nothing was planned" — the two
     * are different and only one of them is the Pimpro's fault.
     */
    out = jValue === 0
      ? setCellValue(out, pRef, '#DIV/0!', true)
      : setCellValue(out, pRef, String(rValue / jValue), false)
  }
  return { xml: out, stale }
}
