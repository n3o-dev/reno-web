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
  readonly locationColumn: string
  readonly jobColumn: string
  /** The fourth descriptive column layouts B and C add, if any. */
  readonly extraColumn: string | null
  /** First R column of the 31-day grid. */
  readonly firstDayColumn: string
}

const LAYOUTS: readonly Layout[] = [
  {
    id: 'A',
    noColumn: 'A',
    locationColumn: 'B',
    jobColumn: 'C',
    extraColumn: null,
    firstDayColumn: 'D',
  },
  {
    id: 'B',
    noColumn: 'B',
    locationColumn: 'C',
    jobColumn: 'D',
    extraColumn: 'PROGRES',
    firstDayColumn: 'F',
  },
  {
    id: 'C',
    noColumn: 'B',
    locationColumn: 'C',
    jobColumn: 'D',
    extraColumn: 'ZONA',
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
  /** Weekend or national holiday, taken from the sheet's own shading. */
  readonly isNonWorkingDay: boolean
}

export interface JobRow {
  readonly no: number
  readonly location: string
  readonly job: string
  readonly rowNumber: number
  readonly days: readonly DayEntry[]
}

export interface Block {
  readonly name: string
  readonly rows: readonly JobRow[]
  /** Sheet row numbers of the three computed rows below the block. */
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
  readonly blocks: readonly Block[]
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
      const location = norm(cells.get(layout.locationColumn)?.value)
      const job = norm(cells.get(layout.jobColumn)?.value)
      if (no !== 'NO' || !location.startsWith('AREA')) continue
      const fourth = norm(cells.get(shiftColumn(layout.jobColumn, 1))?.value)
      if (layout.extraColumn === null) {
        // Layout A has no fourth descriptive column; B and C do.
        if (job.includes('PEKERJAAN') && fourth !== 'PROGRES') return { layout, headerRow: rowNumber }
        continue
      }
      // B and C sit in the same columns; the fourth column is what separates them.
      if (layout.id === 'B' && job.includes('PEKERJAAN') && fourth === 'PROGRES') {
        return { layout, headerRow: rowNumber }
      }
      if (layout.id === 'C' && job === 'ZONA') return { layout, headerRow: rowNumber }
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

/**
 * Weekend and holiday columns are shaded, so their style index differs from the
 * working-day columns. The most common style across the grid is the working day.
 */
function nonWorkingDays(sheet: RawSheet, layout: Layout): Set<number> {
  const counts = new Map<number, number>()
  const styleByDay = new Map<number, number>()
  for (const cells of sheet.rows.values()) {
    for (let day = 1; day <= DAYS_IN_GRID; day++) {
      const style = cells.get(shiftColumn(layout.firstDayColumn, (day - 1) * 2))?.style
      if (style === null || style === undefined) continue
      if (!styleByDay.has(day)) styleByDay.set(day, style)
      counts.set(style, (counts.get(style) ?? 0) + 1)
    }
    if (styleByDay.size === DAYS_IN_GRID) break
  }
  let common: number | null = null
  let best = -1
  for (const [style, n] of counts) {
    if (n > best) {
      best = n
      common = style
    }
  }
  const out = new Set<number>()
  for (const [day, style] of styleByDay) if (style !== common) out.add(day)
  return out
}

function readBlocks(sheet: RawSheet, layout: Layout, headerRow: number): Block[] {
  const blocks: Block[] = []
  const nonWorking = nonWorkingDays(sheet, layout)
  const ordered = [...sheet.rows.keys()].sort((a, b) => a - b).filter((n) => n >= headerRow)

  let name: string | null = null
  let carriedArea: string | null = null
  let rows: JobRow[] = []
  let totals = { jumlah: null as number | null, realisasi: null as number | null, persentasi: null as number | null }

  const flush = (): void => {
    if (rows.length === 0) return
    blocks.push({ name: name ?? 'UNNAMED', rows, totalsRows: totals })
    rows = []
    totals = { jumlah: null, realisasi: null, persentasi: null }
    name = null
  }

  for (const rowNumber of ordered) {
    const cells = sheet.rows.get(rowNumber)
    if (cells === undefined) continue

    const label = norm(cells.get(layout.locationColumn)?.value)
    if (label === 'JUMLAH MCP') totals = { ...totals, jumlah: rowNumber }
    if (label === 'REALISASI MCP') totals = { ...totals, realisasi: rowNumber }
    if (label.startsWith('PERSENTASI')) {
      totals = { ...totals, persentasi: rowNumber }
      flush()
      continue
    }

    const noCell = cells.get(layout.noColumn)?.value ?? null
    const location = cells.get(layout.locationColumn)?.value ?? null
    const job = cells.get(layout.jobColumn)?.value ?? null

    /**
     * A block heading sits alone in the NO column with no job beside it.
     * A block can carry more than one heading — Koridor dalam puts OFFICE MO
     * and MUSHOLLA under a single JUMLAH MCP — so a heading names the block
     * only if it has not been named yet. Blocks end at PERSENTASI, not here.
     */
    if (noCell !== null && !/^\d+$/.test(noCell.trim()) && (job === null || job.trim() === '')) {
      name ??= noCell.trim()
      continue
    }

    if (noCell === null || !/^\d+$/.test(noCell.trim())) continue
    if (job === null || job.trim() === '') continue

    // Layouts B and C state the area once and let it carry down the rows.
    if (location !== null && location.trim() !== '') carriedArea = location.trim()
    const area = carriedArea
    if (area === null) continue

    name ??= area
    rows.push({
      no: Number(noCell.trim()),
      location: area,
      job: job.trim(),
      rowNumber,
      days: readDays(cells, layout, nonWorking),
    })
  }
  flush()
  return blocks
}

export function parseWorkbook(bytes: Uint8Array): Workbook {
  const raw = readRawWorkbook(bytes)
  const sheets = raw.sheets.map((sheet): Sheet => {
    const { layout, headerRow } = detectLayout(sheet)
    return {
      name: sheet.name,
      path: sheet.path,
      layout,
      blocks: readBlocks(sheet, layout, headerRow),
    }
  })
  return { sheets, raw }
}

export async function readWorkbook(path: string): Promise<Workbook> {
  return parseWorkbook(new Uint8Array(await readFile(path)))
}
