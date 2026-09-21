import { unzipSync, zipSync, strFromU8, strToU8 } from 'fflate'
import { parseWorkbook, type Workbook } from './read'
import { columnToIndex, columnOf } from './sheet-xml'
import { DAYS_IN_GRID } from './layout'
import { RkbWriteError } from './write-error'
import { refreshTotals, type TotalsRows } from './totals'

export { RkbWriteError } from './write-error'

/**
 * Writes realised A values back into Reno's own workbook.
 *
 * The rule this module exists to satisfy: Reno opens the file and notices
 * nothing changed except the numbers. That is why this edits the sheet XML
 * surgically rather than round-tripping through a spreadsheet library — a
 * library rebuilds the whole workbook from its own model and quietly drops
 * whatever it did not understand. Here the *contents* of every zip entry
 * except the sheets actually edited are passed through byte for byte, and
 * within those sheets only the target `<c>` elements are touched. The archive
 * itself is rebuilt, so entry timestamps change and the file is not
 * byte-reproducible between runs — do not hash the export to detect changes.
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
  readonly totalsRows: TotalsRows
  readonly blocked: BlockedCell | null
}

/** Maps each edit to the exact cell reference it targets, or refuses it. */
function resolve(book: Workbook, edits: readonly ActualEdit[]): ResolvedEdit[] {
  return edits.map((edit) => {
    if (!Number.isInteger(edit.day) || edit.day < 1 || edit.day > DAYS_IN_GRID) {
      throw new RkbWriteError(`day ${edit.day} is outside 1..${DAYS_IN_GRID}`)
    }
    if (!Number.isFinite(edit.value)) {
      throw new RkbWriteError(
        `value ${edit.value} is not a finite number; writing it produces a workbook Excel cannot open`,
      )
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
    const targets = sheetEdits.map((e) => ({ column: e.totalsColumn, rows: e.totalsRows }))
    next[path] = strToU8(refreshTotals(edited, targets))
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

/**
 * Borrows a neighbour's style for an inserted cell.
 *
 * Same column parity first. R and A columns alternate and carry different
 * styles — 105 and 132 on this workbook, differing in font and alignment — so
 * an A cell's *nearest* neighbour is always its R partner, and copying it
 * would render the value in the wrong font, off-centre. Falls back to the
 * nearest cell of any parity only when the row has no same-parity styled cell.
 */
function neighbourStyle(rowBody: string, target: number): string | null {
  let sameParity: { distance: number; style: string } | null = null
  let anyParity: { distance: number; style: string } | null = null

  for (const cell of rowBody.matchAll(/<c\s[^>]*r="([A-Z]+)\d+"[^>]*?(?:\/>|>)/g)) {
    const column = cell[1]
    const tag = cell[0]
    if (column === undefined) continue
    const style = styleOf(tag)
    if (style === null) continue
    const index = columnToIndex(column)
    const distance = Math.abs(index - target)
    if (distance === 0) continue
    if (anyParity === null || distance < anyParity.distance) anyParity = { distance, style }
    if ((index - target) % 2 === 0) {
      if (sameParity === null || distance < sameParity.distance) {
        sameParity = { distance, style }
      }
    }
  }
  return (sameParity ?? anyParity)?.style ?? null
}

