import { describe, expect, it } from 'vitest'
import { findCell, setCellValue, styleOf } from '@/rkb/cell'

/**
 * `setCellValue` is exported and shared by the cell writer and the totals
 * refresher. Some of its branches are not reachable through `writeActuals`
 * today — a self-closing totals cell has no formula, so it is treated as a
 * literal and skipped — but the function is public surface and a later caller
 * will reach them.
 */
describe('setCellValue', () => {
  it('fills a self-closing cell with exactly one value', () => {
    const out = setCellValue('<row><c r="N18" s="109"/></row>', 'N18', '5', false)
    expect(out).toBe('<row><c r="N18" s="109"><v>5</v></c></row>')
    expect((out.match(/<v>/g) ?? []).length).toBe(1)
  })

  it('fills a formula cell that has no cached value yet', () => {
    const out = setCellValue(
      '<row><c r="N18" s="109"><f>SUM(O11:O16)</f></c></row>',
      'N18',
      '5',
      false,
    )
    expect(out).toContain('<f>SUM(O11:O16)</f><v>5</v>')
    expect((out.match(/<v>/g) ?? []).length).toBe(1)
  })

  it('replaces an existing cached value without disturbing the formula', () => {
    const out = setCellValue(
      '<row><c r="N18" s="109"><f>SUM(O11:O16)</f><v>2</v></c></row>',
      'N18',
      '5',
      false,
    )
    expect(out).toContain('<f>SUM(O11:O16)</f><v>5</v>')
  })

  it('adds the error flag without producing a second type attribute', () => {
    const out = setCellValue('<row><c r="J19" s="111" t="str"><v>x</v></c></row>', 'J19', '#DIV/0!', true)
    expect((out.match(/\st="/g) ?? []).length).toBe(1)
    expect(out).toContain('t="e"')
  })

  it('clears the error flag when the value is no longer an error', () => {
    const out = setCellValue('<row><c r="J19" s="111" t="e"><v>#DIV/0!</v></c></row>', 'J19', '0.5', false)
    expect(out).not.toContain('t="e"')
    expect(out).toContain('<v>0.5</v>')
  })

  it('leaves an already-correct error cell alone apart from its value', () => {
    const before = '<row><c r="J19" s="111" t="e"><v>#DIV/0!</v></c></row>'
    expect(setCellValue(before, 'J19', '#DIV/0!', true)).toBe(before)
  })

  it('returns the document untouched when the cell is absent', () => {
    const before = '<row><c r="A1"/></row>'
    expect(setCellValue(before, 'Z99', '1', false)).toBe(before)
  })
})

describe('findCell', () => {
  it.each([
    ['plain space', '<c r="O12" s="1"/>'],
    ['single-quoted ref', "<c r='O12' s='1'/>"],
    ['newline inside the tag', '<c\n r="O12" s="1"/>'],
    ['tab inside the tag', '<c\t r="O12" s="1"/>'],
    ['CRLF inside the tag', '<c\r\n r="O12" s="1"/>'],
  ])('locates a cell with %s', (_name, cell) => {
    expect(findCell(`<row>${cell}</row>`, 'O12')).not.toBeNull()
  })

  it('does not mistake a longer reference for the one asked for', () => {
    expect(findCell('<row><c r="O120" s="1"/></row>', 'O12')).toBeNull()
    expect(findCell('<row><c r="AO12" s="1"/></row>', 'O12')).toBeNull()
  })

  it.each([
    ['<c r="O12" s="132">', '132'],
    ["<c r='O12' s='132'>", '132'],
    ['<c r="O12">', null],
  ])('reads the style off %s', (tag, expected) => {
    expect(styleOf(tag as string)).toBe(expected)
  })
})
