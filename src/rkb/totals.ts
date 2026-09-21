import { RkbWriteError } from './write-error'

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

export interface TotalsTarget {
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

const colIndex = (column: string): number =>
  [...column].reduce((n, ch) => n * 26 + (ch.charCodeAt(0) - 64), 0)

const colName = (index: number): string => {
  let n = index
  let out = ''
  while (n > 0) {
    const rem = (n - 1) % 26
    out = String.fromCharCode(65 + rem) + out
    n = Math.floor((n - 1) / 26)
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
  for (let c = colIndex(fromCol); c <= colIndex(toCol); c++) {
    for (let r = Number(fromRow); r <= Number(toRow); r++) {
      total += values.get(`${colName(c)}${r}`) ?? 0
    }
  }
  return total
}

interface Found {
  readonly start: number
  readonly end: number
  readonly text: string
}

export function findCell(xml: string, ref: string): Found | null {
  const open = new RegExp(`<c [^>]*r=["']${ref}["'][^>]*?(/?)>`)
  const match = open.exec(xml)
  if (match === null) return null
  if (match[1] === '/') {
    return { start: match.index, end: match.index + match[0].length, text: match[0] }
  }
  const closeAt = xml.indexOf('</c>', match.index)
  if (closeAt === -1) return null
  return { start: match.index, end: closeAt + 4, text: xml.slice(match.index, closeAt + 4) }
}

/** Replaces a cell's cached `<v>` and its error flag, leaving `<f>` untouched. */
export function setCached(xml: string, ref: string, value: string, isError: boolean): string {
  const found = findCell(xml, ref)
  if (found === null) {
    throw new RkbWriteError(`cannot refresh ${ref}: the cell is not in the sheet`)
  }
  // Replace any existing type rather than prepending one: a cell already
  // carrying t="str" would otherwise end up with two t attributes, which is
  // malformed XML and unopenable.
  let text = found.text.replace(/\st="[^"]*"/, '')
  if (isError) text = text.replace(/^<c/, '<c t="e"')
  text = /<v>.*?<\/v>/.test(text)
    ? text.replace(/<v>.*?<\/v>/, `<v>${value}</v>`)
    : text.replace(/\/>$/, `><v>${value}</v></c>`).replace(/<\/c>$/, `<v>${value}</v></c>`)
  return xml.slice(0, found.start) + text + xml.slice(found.end)
}

const formulaOf = (xml: string, ref: string): string | null =>
  /<f>(.*?)<\/f>/.exec(findCell(xml, ref)?.text ?? '')?.[1] ?? null

export function refreshTotals(xml: string, targets: readonly TotalsTarget[]): string {
  let out = xml
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
    if (jFormula === null || rFormula === null) {
      throw new RkbWriteError(`cannot refresh ${jRef}/${rRef}: the totals cells carry no formula`)
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

    out = setCached(out, jRef, String(jValue), false)
    out = setCached(out, rRef, String(rValue), false)

    /**
     * A zero denominator stays #DIV/0!. Replacing it with 0 would read as
     * "nothing was done" when the truth is "nothing was planned" — the two
     * are different and only one of them is the Pimpro's fault.
     */
    out = jValue === 0
      ? setCached(out, pRef, '#DIV/0!', true)
      : setCached(out, pRef, String(rValue / jValue), false)
  }
  return out
}
