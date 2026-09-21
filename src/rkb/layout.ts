import { shiftColumn, type RawSheet } from './sheet-xml'

/**
 * The RKB does not share one schema across its sheets.
 *
 * Two of the six carry a fourth descriptive column and shift the whole day
 * grid one place right, and layout A has no area column at all — its area is
 * the section heading. The layout is therefore detected from each sheet's own
 * header row, never assumed, and a sheet matching none of them fails loudly.
 *
 * See docs/specs/rkb-workbook-io.md (AC-2, AC-9)
 */

export class RkbLayoutError extends Error {
  constructor(sheetName: string, detail: string) {
    super(`sheet "${sheetName}" matches no known RKB layout: ${detail}`)
    this.name = 'RkbLayoutError'
  }
}

export const norm = (value: string | null | undefined): string =>
  (value ?? '').trim().toUpperCase()

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


export interface Detected {
  readonly layout: Layout
  /** Everything above this row is title matter, not data. */
  readonly headerRow: number
}

/** Finds the header row and returns the layout whose columns it matches. */
export function detectLayout(sheet: RawSheet): Detected {
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

