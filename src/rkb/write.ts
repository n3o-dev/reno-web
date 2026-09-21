import { unzipSync, zipSync, strFromU8, strToU8 } from 'fflate'
import { parseWorkbook, type Workbook } from './read'
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

export interface ActualEdit {
  /** Sheet name exactly as the workbook spells it, trailing spaces included. */
  readonly sheet: string
  /** Sheet row number of the job row, as reported by the reader. */
  readonly rowNumber: number
  /** 1-based day of the month. */
  readonly day: number
  readonly value: number
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
}

/** Maps each edit to the exact cell reference it targets, or refuses it. */
function resolve(book: Workbook, edits: readonly ActualEdit[]): ResolvedEdit[] {
  return edits.map((edit) => {
    if (!Number.isInteger(edit.day) || edit.day < 1 || edit.day > DAYS_IN_GRID) {
      throw new RkbWriteError(`day ${edit.day} is outside 1..${DAYS_IN_GRID}`)
    }
    const sheet = book.sheets.find((s) => s.name === edit.sheet)
    if (sheet === undefined) {
      throw new RkbWriteError(`workbook has no sheet named "${edit.sheet}"`)
    }
    const row = sheet.sections
      .flatMap((section) => section.rows)
      .find((r) => r.rowNumber === edit.rowNumber)
    if (row === undefined) {
      throw new RkbWriteError(
        `sheet "${edit.sheet}" has no job row at row ${edit.rowNumber}`,
      )
    }
    const day = row.days[edit.day - 1]
    if (day === undefined) {
      throw new RkbWriteError(`row ${edit.rowNumber} has no day ${edit.day}`)
    }
    return {
      path: sheet.path,
      ref: `${day.aColumn}${row.rowNumber}`,
      rowNumber: row.rowNumber,
      value: edit.value,
    }
  })
}

export function writeActuals(bytes: Uint8Array, edits: readonly ActualEdit[]): Uint8Array {
  const entries = unzipSync(bytes)
  if (edits.length === 0) return zipSync(entries)

  const resolved = resolve(parseWorkbook(bytes), edits)

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
    next[path] = strToU8(applyToSheet(strFromU8(xml), sheetEdits))
  }
  return zipSync(next)
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
