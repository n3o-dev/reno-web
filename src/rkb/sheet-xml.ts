import { unzipSync, strFromU8 } from 'fflate'
import { XMLParser } from 'fast-xml-parser'

/**
 * Minimal OOXML reading, scoped to the shape Reno's RKB actually has.
 *
 * Deliberately not a general spreadsheet library: this repository reads one
 * workbook family and must fail loudly on anything else (see the spec's
 * non-goals). Keeping the surface this small is also what lets the writer
 * modify cells surgically and leave every other byte of the file alone.
 */

export interface Cell {
  /** A1-style reference, e.g. `I12`. */
  readonly ref: string
  readonly column: string
  readonly row: number
  /** Resolved value: shared strings already dereferenced. */
  readonly value: string | null
  /** Style index, which is how the workbook records weekend shading. */
  readonly style: number | null
}

export interface RawSheet {
  readonly name: string
  /** Path inside the zip, e.g. `xl/worksheets/sheet1.xml`. */
  readonly path: string
  readonly rows: ReadonlyMap<number, ReadonlyMap<string, Cell>>
}

export interface RawWorkbook {
  readonly sheets: readonly RawSheet[]
  /** Every zip entry, kept so the writer can rebuild the file untouched. */
  readonly entries: ReadonlyMap<string, Uint8Array>
  /**
   * Style index → font colour, e.g. `FFC00000`. Reno marks weekends and
   * national holidays with a red font on the day-name header row, so this is
   * how a non-working day is recognised.
   */
  readonly fontColourByStyle: ReadonlyMap<number, string>
}

export function columnOf(ref: string): string {
  let out = ''
  for (const ch of ref) {
    if (ch >= 'A' && ch <= 'Z') out += ch
    else break
  }
  return out
}

/** `A` → 1, `Z` → 26, `AA` → 27. */
export function columnToIndex(column: string): number {
  let n = 0
  for (const ch of column) n = n * 26 + (ch.charCodeAt(0) - 64)
  return n
}

/** 1 → `A`, 27 → `AA`. */
export function indexToColumn(index: number): string {
  let n = index
  let out = ''
  while (n > 0) {
    const rem = (n - 1) % 26
    out = String.fromCharCode(65 + rem) + out
    n = Math.floor((n - 1) / 26)
  }
  return out
}

/** Shifts a column reference by a number of places: `D` + 2 → `F`. */
export function shiftColumn(column: string, by: number): string {
  return indexToColumn(columnToIndex(column) + by)
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@',
  // Sheet names carry meaningful trailing spaces ("RKB TOILET ") and the
  // writer has to match them exactly, so nothing may be trimmed for us.
  trimValues: false,
  isArray: (name) =>
    name === 'row' || name === 'c' || name === 'sheet' || name === 'si' || name === 'font' || name === 'xf',
})

function asArray(value: unknown): unknown[] {
  if (value === undefined || value === null) return []
  return Array.isArray(value) ? value : [value]
}

function textOf(node: unknown): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (typeof node !== 'object' || node === null) return ''
  const obj = node as Record<string, unknown>
  if (typeof obj['#text'] === 'string' || typeof obj['#text'] === 'number') {
    return String(obj['#text'])
  }
  // A shared string can be split across several <t> runs.
  return asArray(obj.t).map(textOf).join('')
}

export function readRawWorkbook(bytes: Uint8Array): RawWorkbook {
  const entries = unzipSync(bytes)
  const entryMap = new Map<string, Uint8Array>(Object.entries(entries))

  const sharedStrings: string[] = []
  const sstEntry = entryMap.get('xl/sharedStrings.xml')
  if (sstEntry !== undefined) {
    const sst = parser.parse(strFromU8(sstEntry)) as Record<string, unknown>
    const root = (sst.sst ?? {}) as Record<string, unknown>
    for (const si of asArray(root.si)) sharedStrings.push(textOf(si))
  }

  const workbook = parser.parse(strFromU8(mustRead(entryMap, 'xl/workbook.xml'))) as Record<
    string,
    unknown
  >
  const rels = parser.parse(
    strFromU8(mustRead(entryMap, 'xl/_rels/workbook.xml.rels')),
  ) as Record<string, unknown>

  const relTargets = new Map<string, string>()
  const relRoot = (rels.Relationships ?? {}) as Record<string, unknown>
  for (const rel of asArray(relRoot.Relationship)) {
    const r = rel as Record<string, unknown>
    relTargets.set(String(r['@Id']), String(r['@Target']))
  }

  const wbRoot = (workbook.workbook ?? {}) as Record<string, unknown>
  const sheetsNode = (wbRoot.sheets ?? {}) as Record<string, unknown>

  const sheets: RawSheet[] = []
  for (const sheet of asArray(sheetsNode.sheet)) {
    const s = sheet as Record<string, unknown>
    const target = relTargets.get(String(s['@r:id']))
    if (target === undefined) throw new Error(`sheet "${String(s['@name'])}" has no relationship`)
    const path = target.startsWith('/') ? target.slice(1) : `xl/${target}`
    sheets.push({
      name: String(s['@name']),
      path,
      rows: parseSheet(strFromU8(mustRead(entryMap, path)), sharedStrings),
    })
  }

  return { sheets, entries: entryMap, fontColourByStyle: readFontColours(entryMap) }
}

/** Resolves each cellXf to its font colour, when the font declares one. */
function readFontColours(entries: Map<string, Uint8Array>): Map<number, string> {
  const out = new Map<number, string>()
  const stylesEntry = entries.get('xl/styles.xml')
  if (stylesEntry === undefined) return out

  const doc = parser.parse(strFromU8(stylesEntry)) as Record<string, unknown>
  const styleSheet = (doc.styleSheet ?? {}) as Record<string, unknown>

  const fontsNode = (styleSheet.fonts ?? {}) as Record<string, unknown>
  const colours: (string | null)[] = asArray(fontsNode.font).map((font) => {
    const f = font as Record<string, unknown>
    const colour = f.color as Record<string, unknown> | undefined
    const rgb = colour?.['@rgb']
    return typeof rgb === 'string' ? rgb : null
  })

  const xfsNode = (styleSheet.cellXfs ?? {}) as Record<string, unknown>
  asArray(xfsNode.xf).forEach((xf, index) => {
    const fontId = Number((xf as Record<string, unknown>)['@fontId'] ?? -1)
    const colour = colours[fontId]
    if (colour !== null && colour !== undefined) out.set(index, colour)
  })
  return out
}

function mustRead(entries: Map<string, Uint8Array>, path: string): Uint8Array {
  const found = entries.get(path)
  if (found === undefined) throw new Error(`workbook is missing ${path}; this is not an RKB file`)
  return found
}

function parseSheet(xml: string, sharedStrings: readonly string[]): Map<number, Map<string, Cell>> {
  const doc = parser.parse(xml) as Record<string, unknown>
  const worksheet = (doc.worksheet ?? {}) as Record<string, unknown>
  const sheetData = (worksheet.sheetData ?? {}) as Record<string, unknown>

  const rows = new Map<number, Map<string, Cell>>()
  for (const row of asArray(sheetData.row)) {
    const r = row as Record<string, unknown>
    const rowNumber = Number(r['@r'])
    const cells = new Map<string, Cell>()
    for (const cell of asArray(r.c)) {
      const c = cell as Record<string, unknown>
      const ref = String(c['@r'])
      const type = c['@t'] === undefined ? null : String(c['@t'])
      const style = c['@s'] === undefined ? null : Number(c['@s'])

      let value: string | null = null
      if (c.v !== undefined) {
        const raw = textOf(c.v)
        value = type === 's' ? (sharedStrings[Number(raw)] ?? null) : raw
      } else if (c.is !== undefined) {
        value = textOf(c.is)
      }

      cells.set(columnOf(ref), { ref, column: columnOf(ref), row: rowNumber, value, style })
    }
    rows.set(rowNumber, cells)
  }
  return rows
}
