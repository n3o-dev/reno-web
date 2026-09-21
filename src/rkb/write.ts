import { unzipSync, zipSync, strFromU8, strToU8 } from 'fflate'
import { parseWorkbook, type Section, type Workbook } from './read'
import { columnToIndex, columnOf } from './sheet-xml'
import { DAYS_IN_GRID } from './layout'

/**
 * Writes realised A values back into Reno's own workbook.
 *
 * The rule this module exists to satisfy: Reno opens the file and notices
 * nothing changed except the numbers. That is why this edits the sheet XML
 * surgically rather than round-tripping through a spreadsheet library — a
 * library rebuilds the whole workbook from its own model and quietly drops
 * whatever it did not understand. Here, every zip entry except the sheets
 * actually edited is passed through byte for byte, and within those sheets
 * only the target `<c>` elements are touched.
 *
 * See docs/specs/rkb-workbook-io.md (AC-5, AC-6)
 */

export interface BlockedReason {
  readonly reason: string
  /** The message that justifies the block. A block without one is invalid. */
  readonly source_message_id: string
}

export interface ActualEdit {
  /** Sheet name exactly as the workbook spells it, trailing spaces included. */
  readonly sheet: string
  /** Sheet row number of the job row, as reported by the reader. */
  readonly rowNumber: number
  /** 1-based day of the month. */
  readonly day: number
  readonly value: number
  /**
   * Present when the row could not proceed for a reason outside Reno's
   * control. The workbook still records a plain 0 — Reno has not agreed to any
   * marker for this, and inventing one would put a word in their file that
   * their own process does not recognise. The block travels back to the caller
   * instead, on `WriteResult.blocked`.
   */
  readonly blocked?: BlockedReason
}

export interface BlockedCell {
  readonly sheet: string
  readonly rowNumber: number
  readonly day: number
  readonly ref: string
  readonly reason: string
  readonly source_message_id: string
}

export interface WriteResult {
  readonly bytes: Uint8Array
  /** Blocks recorded alongside the file, never written into it. */
  readonly blocked: readonly BlockedCell[]
}

export class RkbWriteError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'RkbWriteError'
  }
}

interface ResolvedEdit {
  readonly path: string
  readonly ref: string
  readonly rowNumber: number
  readonly value: number
  /**
   * The totals cells for a day sit in its R column, not its A column — N18
   * holds SUM(O11:O16). This is the column whose totals need refreshing.
   */
  readonly totalsColumn: string
  readonly totalsRows: Section['totalsRows']
  readonly blocked: BlockedCell | null
}

/** Maps each edit to the exact cell reference it targets, or refuses it. */
function resolve(book: Workbook, edits: readonly ActualEdit[]): ResolvedEdit[] {
  return edits.map((edit) => {
    if (!Number.isInteger(edit.day) || edit.day < 1 || edit.day > DAYS_IN_GRID) {
      throw new RkbWriteError(`day ${edit.day} is outside 1..${DAYS_IN_GRID}`)
    }
    if (edit.blocked !== undefined) {
      if (edit.value !== 0) {
        throw new RkbWriteError(
          `a blocked row must write 0, not ${edit.value}: blocked work is not realised work`,
        )
      }
      if (edit.blocked.reason.trim() === '') {
        throw new RkbWriteError('a block requires a written reason')
      }
      if (edit.blocked.source_message_id.trim() === '') {
        throw new RkbWriteError(
          'a block requires a citation: the source message that justifies it',
        )
      }
    }
    const sheet = book.sheets.find((s) => s.name === edit.sheet)
    if (sheet === undefined) {
      throw new RkbWriteError(`workbook has no sheet named "${edit.sheet}"`)
    }
    const section = sheet.sections.find((sec) =>
      sec.rows.some((r) => r.rowNumber === edit.rowNumber),
    )
    const row = section?.rows.find((r) => r.rowNumber === edit.rowNumber)
    if (section === undefined || row === undefined) {
      throw new RkbWriteError(
        `sheet "${edit.sheet}" has no job row at row ${edit.rowNumber}`,
      )
    }
    const day = row.days[edit.day - 1]
    if (day === undefined) {
      throw new RkbWriteError(`row ${edit.rowNumber} has no day ${edit.day}`)
    }
    const ref = `${day.aColumn}${row.rowNumber}`
    return {
      path: sheet.path,
      ref,
      rowNumber: row.rowNumber,
      value: edit.value,
      totalsColumn: day.rColumn,
      totalsRows: section.totalsRows,
      blocked:
        edit.blocked === undefined
          ? null
          : {
              sheet: edit.sheet,
              rowNumber: edit.rowNumber,
              day: edit.day,
              ref,
              reason: edit.blocked.reason,
              source_message_id: edit.blocked.source_message_id,
            },
    }
  })
}

export function writeActuals(bytes: Uint8Array, edits: readonly ActualEdit[]): WriteResult {
  const entries = unzipSync(bytes)
  if (edits.length === 0) return { bytes: zipSync(entries), blocked: [] }

  const resolved = resolve(parseWorkbook(bytes), edits)
  const blocked = resolved
    .map((edit) => edit.blocked)
    .filter((b): b is BlockedCell => b !== null)

  const bySheet = new Map<string, ResolvedEdit[]>()
  for (const edit of resolved) {
    const list = bySheet.get(edit.path) ?? []
    list.push(edit)
    bySheet.set(edit.path, list)
  }

  const next: Record<string, Uint8Array> = { ...entries }
  for (const [path, sheetEdits] of bySheet) {
    const xml = entries[path]
    if (xml === undefined) throw new RkbWriteError(`workbook is missing ${path}`)
    const edited = applyToSheet(strFromU8(xml), sheetEdits)
    next[path] = strToU8(refreshTotals(edited, sheetEdits))
  }
  return { bytes: zipSync(next), blocked }
}

/** A numeric cell: `<c r="I12" s="105"><v>1</v></c>`. */
const numericCell = (ref: string, style: string | null, value: number): string =>
  `<c r="${ref}"${style === null ? '' : ` s="${style}"`}><v>${value}</v></c>`

function applyToSheet(xml: string, edits: readonly ResolvedEdit[]): string {
  let out = xml
  for (const edit of edits) {
    out = existingCell(out, edit.ref) === null
      ? insertCell(out, edit)
      : replaceCellValue(out, edit)
  }
  return out
}

/** Locates `<c r="REF" …>…</c>`, or a self-closing `<c r="REF" …/>`. */
function existingCell(xml: string, ref: string): { start: number; end: number; tag: string } | null {
  const open = new RegExp(`<c\\s[^>]*r="${ref}"[^>]*?(/?)>`)
  const match = open.exec(xml)
  if (match === null) return null
  const selfClosing = match[1] === '/'
  if (selfClosing) {
    return { start: match.index, end: match.index + match[0].length, tag: match[0] }
  }
  const closeAt = xml.indexOf('</c>', match.index)
  if (closeAt === -1) return null
  return { start: match.index, end: closeAt + 4, tag: match[0] }
}

function styleOf(tag: string): string | null {
  const style = /\ss="(\d+)"/.exec(tag)
  return style === null ? null : (style[1] ?? null)
}

function replaceCellValue(xml: string, edit: ResolvedEdit): string {
  const found = existingCell(xml, edit.ref)
  if (found === null) return xml
  // Rewrite the whole element: an existing cell may hold a formula, a shared
  // string or an inline string, and the A column must end up a plain number.
  const replacement = numericCell(edit.ref, styleOf(found.tag), edit.value)
  return xml.slice(0, found.start) + replacement + xml.slice(found.end)
}

/**
 * Inserts a cell that is absent from the file, in column order within its row.
 * Excel tolerates out-of-order cells, but Reno's file is ordered and leaving it
 * ordered keeps a diff of the XML readable.
 */
function insertCell(xml: string, edit: ResolvedEdit): string {
  const rowOpen = new RegExp(`<row\\s[^>]*r="${edit.rowNumber}"[^>]*?(/?)>`)
  const match = rowOpen.exec(xml)
  if (match === null) {
    throw new RkbWriteError(`sheet has no <row r="${edit.rowNumber}"> to insert ${edit.ref} into`)
  }
  if (match[1] === '/') {
    throw new RkbWriteError(`row ${edit.rowNumber} is empty; refusing to write ${edit.ref}`)
  }

  const rowStart = match.index + match[0].length
  const rowEnd = xml.indexOf('</row>', rowStart)
  if (rowEnd === -1) throw new RkbWriteError(`row ${edit.rowNumber} is not closed`)

  const body = xml.slice(rowStart, rowEnd)
  const target = columnToIndex(columnOf(edit.ref))
  const style = neighbourStyle(body, target)

  let insertAt = body.length
  for (const cell of body.matchAll(/<c\s[^>]*r="([A-Z]+)\d+"[^>]*?(?:\/>|>)/g)) {
    const column = cell[1]
    if (column === undefined) continue
    if (columnToIndex(column) > target) {
      insertAt = cell.index
      break
    }
  }

  const nextBody =
    body.slice(0, insertAt) + numericCell(edit.ref, style, edit.value) + body.slice(insertAt)
  return xml.slice(0, rowStart) + nextBody + xml.slice(rowEnd)
}

/** Borrows the style of the nearest cell in the same row, so formatting matches. */
function neighbourStyle(rowBody: string, target: number): string | null {
  let best: { distance: number; style: string } | null = null
  for (const cell of rowBody.matchAll(/<c\s[^>]*r="([A-Z]+)\d+"[^>]*?(?:\/>|>)/g)) {
    const column = cell[1]
    const tag = cell[0]
    if (column === undefined) continue
    const style = styleOf(tag)
    if (style === null) continue
    const distance = Math.abs(columnToIndex(column) - target)
    if (best === null || distance < best.distance) best = { distance, style }
  }
  return best?.style ?? null
}

/* -------------------------------------------------------------------------
 * Totals
 *
 * The JUMLAH / REALISASI / PERSENTASI rows are Reno's own formulas with cached
 * results. The formulas are never rewritten — only their cached values are
 * refreshed, so a reader that does not recalculate still sees the truth and
 * Excel still recalculates on open exactly as before.
 * ---------------------------------------------------------------------- */

/** Numeric values by cell reference, for evaluating a SUM range. */
function valueMap(xml: string): Map<string, number> {
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

/** Evaluates `SUM(E11:E16)` against a value map. Only the SUM form is used here. */
function evaluateSum(formula: string, values: ReadonlyMap<string, number>): number | null {
  const range = /^SUM\(([A-Z]+)(\d+):([A-Z]+)(\d+)\)$/.exec(formula.trim())
  if (range === null) return null
  const [, col, fromRow, , toRow] = range
  if (col === undefined || fromRow === undefined || toRow === undefined) return null
  let total = 0
  for (let r = Number(fromRow); r <= Number(toRow); r++) total += values.get(`${col}${r}`) ?? 0
  return total
}

function findCell(xml: string, ref: string): { start: number; end: number; text: string } | null {
  const open = new RegExp(`<c [^>]*r="${ref}"[^>]*?(/?)>`)
  const match = open.exec(xml)
  if (match === null) return null
  if (match[1] === '/') return { start: match.index, end: match.index + match[0].length, text: match[0] }
  const closeAt = xml.indexOf('</c>', match.index)
  if (closeAt === -1) return null
  return { start: match.index, end: closeAt + 4, text: xml.slice(match.index, closeAt + 4) }
}

/** Replaces a cell's cached `<v>` and its error flag, leaving `<f>` untouched. */
function setCached(xml: string, ref: string, value: string, isError: boolean): string {
  const found = findCell(xml, ref)
  if (found === null) return xml
  let text = found.text
  text = isError
    ? (/\st="e"/.test(text) ? text : text.replace(/^<c /, '<c t="e" '))
    : text.replace(/\st="e"/, '')
  text = /<v>.*?<\/v>/.test(text)
    ? text.replace(/<v>.*?<\/v>/, `<v>${value}</v>`)
    : text.replace('</c>', `<v>${value}</v></c>`)
  return xml.slice(0, found.start) + text + xml.slice(found.end)
}

const formulaOf = (xml: string, ref: string): string | null =>
  /<f>(.*?)<\/f>/.exec(findCell(xml, ref)?.text ?? '')?.[1] ?? null

function refreshTotals(xml: string, edits: readonly ResolvedEdit[]): string {
  let out = xml
  const seen = new Set<string>()

  for (const edit of edits) {
    const { jumlah, realisasi, persentasi } = edit.totalsRows
    if (jumlah === null || realisasi === null || persentasi === null) continue
    const key = `${edit.totalsColumn}:${jumlah}`
    if (seen.has(key)) continue
    seen.add(key)

    const values = valueMap(out)
    const jRef = `${edit.totalsColumn}${jumlah}`
    const rRef = `${edit.totalsColumn}${realisasi}`
    const pRef = `${edit.totalsColumn}${persentasi}`

    const jFormula = formulaOf(out, jRef)
    const rFormula = formulaOf(out, rRef)
    const jValue = jFormula === null ? null : evaluateSum(jFormula, values)
    const rValue = rFormula === null ? null : evaluateSum(rFormula, values)
    if (jValue === null || rValue === null) continue

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
