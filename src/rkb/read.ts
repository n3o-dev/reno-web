import { readFile } from 'node:fs/promises'
import {
  readRawWorkbook,
  shiftColumn,
  type Cell,
  type RawSheet,
  type RawWorkbook,
} from './sheet-xml'

/**
 * Reads Reno's monthly RKB workbook.
 *
 * The workbook does not share one schema: two of its six sheets carry a fourth
 * descriptive column and shift the whole day grid one place right. The layout
 * is therefore detected from each sheet's own header row rather than assumed,
 * and a sheet matching none of them fails loudly.
 *
 * See docs/specs/rkb-workbook-io.md
 */

export const DAYS_IN_GRID = 31

export interface Layout {
  readonly id: 'A' | 'B' | 'C'
  /** Column holding the `NO` value. */
  readonly noColumn: string
  /**
   * Column repeating the area for every row. Layout A has none — its area is
   * the section heading — so the three layouts are not simply shifted copies.
   */
  readonly areaColumn: string | null
  /** The thing being cleaned: `Cover lampu`, `SISI HOTEL`, `RUANG LVMDP`. */
  readonly subjectColumn: string
  /** The work done to it: `Dusting`, `SPOOTING / GLASS CLEANING`. */
  readonly workColumn: string
  /** Header text of the extra column B and C carry, used to tell them apart. */
  readonly discriminator: string | null
  /** First R column of the 31-day grid. */
  readonly firstDayColumn: string
}

const LAYOUTS: readonly Layout[] = [
  {
    id: 'A',
    noColumn: 'A',
    areaColumn: null,
    subjectColumn: 'B',
    workColumn: 'C',
    discriminator: null,
    firstDayColumn: 'D',
  },
  {
    id: 'B',
    noColumn: 'B',
    areaColumn: 'C',
    subjectColumn: 'D',
    workColumn: 'E',
    discriminator: 'PROGRES',
    firstDayColumn: 'F',
  },
  {
    id: 'C',
    noColumn: 'B',
    areaColumn: 'C',
    subjectColumn: 'D',
    workColumn: 'E',
    discriminator: 'ZONA',
    firstDayColumn: 'F',
  },
]

export interface DayEntry {
  /** 1-based day of the month. */
  readonly day: number
  readonly rColumn: string
  readonly aColumn: string
  readonly planned: number | null
  readonly actual: number | null
  /** Weekend or national holiday, from the red font on the day-name header row. */
  readonly isNonWorkingDay: boolean
}

export interface JobRow {
  readonly no: number
  /** The area group: the section heading on layout A, the AREA column on B and C. */
  readonly area: string
  /** The thing being cleaned. */
  readonly subject: string
  /** The work done to it. On B and C this is the PROGRES column. */
  readonly work: string
  readonly rowNumber: number
  readonly days: readonly DayEntry[]
}

/**
 * A run of job rows ending at a `PERSENTASI (%)` row.
 *
 * Named Section, not Block: CONTEXT.md reserves "Blocked" for a job row that
 * could not proceed, and the writer is about to deal with both.
 */
export interface Section {
  readonly name: string
  readonly rows: readonly JobRow[]
  /** Sheet row numbers of the three computed rows below the section. */
  readonly totalsRows: {
    readonly jumlah: number | null
    readonly realisasi: number | null
    readonly persentasi: number | null
  }
}

export interface Sheet {
  readonly name: string
  readonly path: string
  readonly layout: Layout
  readonly sections: readonly Section[]
}

export interface Workbook {
  readonly sheets: readonly Sheet[]
  readonly raw: RawWorkbook
}

export class RkbLayoutError extends Error {
  constructor(sheetName: string, detail: string) {
    super(`sheet "${sheetName}" matches no known RKB layout: ${detail}`)
    this.name = 'RkbLayoutError'
  }
}

const norm = (value: string | null | undefined): string => (value ?? '').trim().toUpperCase()

interface Detected {
  readonly layout: Layout
  /** Everything above this row is title matter, not data. */
  readonly headerRow: number
}

/** Finds the header row and returns the layout whose columns it matches. */
function detectLayout(sheet: RawSheet): Detected {
  for (const [rowNumber, cells] of sheet.rows) {
    for (const layout of LAYOUTS) {
      const no = norm(cells.get(layout.noColumn)?.value)
      // The column after NO always heads the area or the subject, and always says AREA.
      const headsArea = norm(cells.get(shiftColumn(layout.noColumn, 1))?.value).startsWith('AREA')
      if (no !== 'NO' || !headsArea) continue

      if (layout.discriminator === null) {
        // Layout A: the third column is the work, and there is no fourth.
        const work = norm(cells.get(layout.workColumn)?.value)
        const fourth = norm(cells.get(shiftColumn(layout.workColumn, 1))?.value)
        if (work.includes('PEKERJAAN') && fourth !== 'PROGRES') {
          return { layout, headerRow: rowNumber }
        }
        continue
      }
      // B and C sit in the same columns; the third column header separates them.
      const third = norm(cells.get(layout.subjectColumn)?.value)
      const fourth = norm(cells.get(layout.workColumn)?.value)
      if (fourth !== 'PROGRES') continue
      if (layout.id === 'B' && third.includes('PEKERJAAN')) return { layout, headerRow: rowNumber }
      if (layout.id === 'C' && third === 'ZONA') return { layout, headerRow: rowNumber }
    }
  }
  throw new RkbLayoutError(sheet.name, 'no header row with NO / AREA / job columns was found')
}

const asNumber = (cell: Cell | undefined): number | null => {
  const raw = cell?.value
  if (raw === null || raw === undefined || raw.trim() === '') return null
  const n = Number(raw)
  return Number.isFinite(n) ? n : null
}

function readDays(
  cells: ReadonlyMap<string, Cell>,
  layout: Layout,
  nonWorking: ReadonlySet<number>,
): DayEntry[] {
  const days: DayEntry[] = []
  for (let day = 1; day <= DAYS_IN_GRID; day++) {
    const rColumn = shiftColumn(layout.firstDayColumn, (day - 1) * 2)
    const aColumn = shiftColumn(rColumn, 1)
    days.push({
      day,
      rColumn,
      aColumn,
      planned: asNumber(cells.get(rColumn)),
      actual: asNumber(cells.get(aColumn)),
      isNonWorkingDay: nonWorking.has(day),
    })
  }
  return days
}

/** Dark red — how the workbook marks a weekend or national holiday. */
const NON_WORKING_FONT = 'FFC00000'

/**
 * Reno marks non-working days with a red font on the day-name header row — the
 * row spelling RB / KM / JM / SB / MG, immediately below the column header.
 * Not a fill: the weekend and weekday styles share a fillId and differ only in
 * their font, which is why reading the fill finds nothing.
 */
function nonWorkingDays(
  sheet: RawSheet,
  layout: Layout,
  headerRow: number,
  fontColourByStyle: ReadonlyMap<number, string>,
): Set<number> {
  const out = new Set<number>()
  const dayNames = sheet.rows.get(headerRow + 1)
  if (dayNames === undefined) return out

  for (let day = 1; day <= DAYS_IN_GRID; day++) {
    const style = dayNames.get(shiftColumn(layout.firstDayColumn, (day - 1) * 2))?.style
    if (style === null || style === undefined) continue
    if (fontColourByStyle.get(style) === NON_WORKING_FONT) out.add(day)
  }
  return out
}

/** Finds a totals label anywhere in the row — Facade puts them in D, the rest in B. */
function totalsLabelOf(cells: ReadonlyMap<string, Cell>): 'jumlah' | 'realisasi' | 'persentasi' | null {
  for (const cell of cells.values()) {
    const text = norm(cell.value)
    if (text === 'JUMLAH MCP') return 'jumlah'
    if (text === 'REALISASI MCP') return 'realisasi'
    if (text.startsWith('PERSENTASI')) return 'persentasi'
  }
  return null
}

function readSections(
  sheet: RawSheet,
  layout: Layout,
  headerRow: number,
  fontColourByStyle: ReadonlyMap<number, string>,
): Section[] {
  const sections: Section[] = []
  const nonWorking = nonWorkingDays(sheet, layout, headerRow, fontColourByStyle)
  const ordered = [...sheet.rows.keys()].sort((a, b) => a - b).filter((n) => n >= headerRow)

  let name: string | null = null
  let carriedArea: string | null = null
  let carriedWork: string | null = null
  let rows: JobRow[] = []
  let totals = {
    jumlah: null as number | null,
    realisasi: null as number | null,
    persentasi: null as number | null,
  }

  const flush = (): void => {
    if (rows.length === 0) return
    sections.push({ name: name ?? 'UNNAMED', rows, totalsRows: totals })
    rows = []
    totals = { jumlah: null, realisasi: null, persentasi: null }
    name = null
  }

  for (const rowNumber of ordered) {
    const cells = sheet.rows.get(rowNumber)
    if (cells === undefined) continue

    const label = totalsLabelOf(cells)
    if (label === 'jumlah') totals = { ...totals, jumlah: rowNumber }
    if (label === 'realisasi') totals = { ...totals, realisasi: rowNumber }
    if (label === 'persentasi') {
      totals = { ...totals, persentasi: rowNumber }
      flush()
      continue
    }
    if (label !== null) continue

    const noCell = cells.get(layout.noColumn)?.value ?? null
    const subject = cells.get(layout.subjectColumn)?.value ?? null
    const workCell = cells.get(layout.workColumn)?.value ?? null

    /**
     * A section heading sits alone in the NO column with no subject beside it.
     * A section can carry more than one heading — Koridor dalam puts OFFICE MO
     * and MUSHOLLA under a single JUMLAH MCP — so a heading names the section
     * only if it has not been named yet. Sections end at PERSENTASI, not here.
     */
    if (
      noCell !== null &&
      !/^\d+$/.test(noCell.trim()) &&
      (subject === null || subject.trim() === '')
    ) {
      name ??= noCell.trim()
      continue
    }

    if (noCell === null || !/^\d+$/.test(noCell.trim())) continue
    if (subject === null || subject.trim() === '') continue

    /**
     * Layouts B and C state the area and the work once and let both carry down
     * the rows beneath — Ruang Utility writes SWEEPING,MOPPING… on the first
     * row of a floor and leaves it blank for the rest. Requiring a value on
     * every row loses 23 of its 29 rows.
     */
    if (layout.areaColumn !== null) {
      const areaCell = cells.get(layout.areaColumn)?.value ?? null
      if (areaCell !== null && areaCell.trim() !== '') carriedArea = areaCell.trim()
    }
    if (workCell !== null && workCell.trim() !== '') carriedWork = workCell.trim()

    const area: string | null = layout.areaColumn === null ? name : carriedArea
    const work: string | null = layout.areaColumn === null ? workCell : carriedWork
    if (area === null || work === null || work.trim() === '') continue

    name ??= area
    rows.push({
      no: Number(noCell.trim()),
      area,
      subject: subject.trim(),
      work: work.trim(),
      rowNumber,
      days: readDays(cells, layout, nonWorking),
    })
  }
  flush()
  return sections
}

export function parseWorkbook(bytes: Uint8Array): Workbook {
  const raw = readRawWorkbook(bytes)
  const sheets = raw.sheets.map((sheet): Sheet => {
    const { layout, headerRow } = detectLayout(sheet)
    return {
      name: sheet.name,
      path: sheet.path,
      layout,
      sections: readSections(sheet, layout, headerRow, raw.fontColourByStyle),
    }
  })
  return { sheets, raw }
}

export async function readWorkbook(path: string): Promise<Workbook> {
  return parseWorkbook(new Uint8Array(await readFile(path)))
}
