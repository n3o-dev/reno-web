import { columnToIndex, indexToColumn } from './sheet-xml'

export { columnToIndex, indexToColumn }

export interface FoundCell {
  readonly start: number
  readonly end: number
  readonly text: string
}

/**
 * Locates `<c r="REF" …>…</c>` or a self-closing `<c r="REF" …/>`.
 *
 * One locator, shared by the cell writer and the totals refresher. They were
 * two near-identical functions once and drifted apart — a fix applied to one
 * silently missed the other.
 */
export function findCell(xml: string, ref: string): FoundCell | null {
  const open = new RegExp(`<c\\s[^>]*r=["']${ref}["'][^>]*?(/?)>`)
  const match = open.exec(xml)
  if (match === null) return null
  if (match[1] === '/') {
    return { start: match.index, end: match.index + match[0].length, text: match[0] }
  }
  const closeAt = xml.indexOf('</c>', match.index)
  if (closeAt === -1) return null
  return { start: match.index, end: closeAt + 4, text: xml.slice(match.index, closeAt + 4) }
}

export const styleOf = (tag: string): string | null =>
  /\ss=["'](\d+)["']/.exec(tag)?.[1] ?? null

/**
 * Replaces a cell's cached `<v>` and its error flag, leaving `<f>` untouched.
 *
 * The branches are exclusive on purpose: chaining the replacements let the
 * self-closing branch's own output match the second pattern, producing two
 * `<v>` children — well-formed XML but invalid against CT_Cell, which Excel
 * offers to repair.
 */
export function setCellValue(
  xml: string,
  ref: string,
  value: string,
  isError: boolean,
): string {
  const found = findCell(xml, ref)
  if (found === null) return xml

  let text = found.text
  const hasError = /\st="e"/.test(text)
  if (isError && !hasError) {
    // Replace any other type rather than prepending: a cell already carrying
    // t="str" would otherwise end up with two t attributes.
    text = /\st="[^"]*"/.test(text)
      ? text.replace(/\st="[^"]*"/, ' t="e"')
      : text.replace(/^<c/, '<c t="e"')
  } else if (!isError && hasError) {
    text = text.replace(/\st="e"/, '')
  }

  if (/<v>.*?<\/v>/.test(text)) {
    text = text.replace(/<v>.*?<\/v>/, `<v>${value}</v>`)
  } else if (text.endsWith('/>')) {
    text = `${text.slice(0, -2)}><v>${value}</v></c>`
  } else {
    text = text.replace(/<\/c>$/, `<v>${value}</v></c>`)
  }
  return xml.slice(0, found.start) + text + xml.slice(found.end)
}
