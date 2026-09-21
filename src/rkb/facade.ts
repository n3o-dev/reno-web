import type { Workbook } from './read'

/**
 * The Facade sheet is not a per-day tick like the others.
 *
 * It carries a date-banded access-equipment schedule and a rain-contingency
 * substitution list, both as free text below the grid. They are parsed rather
 * than ignored because they are the evidence behind a blocked Facade row: a
 * row planned for the 8th could not proceed if the car gondola was not on site.
 *
 * The source text is hand-typed and carries real typos — MENGGUKAN, TANGAL,
 * ROOP ACCES, SCHAFOOLDING — so the patterns here are deliberately loose about
 * spelling and strict only about the numbers.
 *
 * See docs/specs/rkb-workbook-io.md (AC-4)
 */

export interface EquipmentBand {
  /** Access equipment as written, typos and all — it is quoted back to the client. */
  readonly equipment: string
  readonly from: number
  readonly to: number
  readonly text: string
}

export interface FacadeSchedule {
  readonly equipmentBands: readonly EquipmentBand[]
  readonly rainContingency: readonly string[]
}

const FACADE_SHEET = 'RKB FACADE'

/** `TANGGAL 01 S/D 06`, `TANGAL 07 S/D 11`, `TANGGAL 28 & 29` — spelling varies, numbers do not. */
const BAND = /TANG+AL\s+(\d{1,2})\s*(?:S\/D|&|-)\s*(\d{1,2})/i
const RAIN_MARKER = /PENGALIHAN\s+PEKERJAAN/i

export function readFacadeSchedule(book: Workbook): FacadeSchedule {
  const sheet = book.raw.sheets.find((s) => s.name === FACADE_SHEET)
  if (sheet === undefined) throw new Error(`workbook has no "${FACADE_SHEET}" sheet`)

  const ordered = [...sheet.rows.keys()].sort((a, b) => a - b)
  const equipmentBands: EquipmentBand[] = []
  const rainContingency: string[] = []
  let rainMarkerRow: number | null = null
  let lastCaptured = -1

  for (const rowNumber of ordered) {
    const cells = sheet.rows.get(rowNumber)
    if (cells === undefined) continue

    for (const cell of cells.values()) {
      const text = cell.value?.trim()
      if (text === undefined || text === '' || text.length < 12) continue

      if (rainMarkerRow === null && RAIN_MARKER.test(text)) {
        rainMarkerRow = rowNumber
        lastCaptured = rowNumber
        continue
      }

      if (rainMarkerRow === null) {
        const match = BAND.exec(text)
        if (match !== null) {
          const from = Number(match[1])
          const to = Number(match[2])
          equipmentBands.push({
            equipment: text.slice(0, match.index).replace(/^PENGERJAAN\s+/i, '').trim(),
            from,
            to,
            text,
          })
        }
        continue
      }

      /**
       * The substitution list is the contiguous run of rows below the marker.
       * Stopping at the first gap keeps the legend and the signature block —
       * which sit further down the sheet — out of the list.
       */
      if (rowNumber > rainMarkerRow && rowNumber === lastCaptured + 1) {
        rainContingency.push(text)
        lastCaptured = rowNumber
      }
    }
  }

  return { equipmentBands, rainContingency }
}

/** The equipment a Facade row depends on for a given day, if any is scheduled. */
export function equipmentForDay(
  schedule: FacadeSchedule,
  day: number,
): EquipmentBand | null {
  return schedule.equipmentBands.find((b) => day >= b.from && day <= b.to) ?? null
}
