/**
 * AC-11 — the shipped palette passes the data-viz gates.
 *
 * Reads the values out of globals.css rather than keeping a second copy here:
 * a check that holds its own palette is checking itself, not the product.
 * The validator is vendored at scripts/vendor/validate_palette.js so this runs
 * without the authoring skill present.
 */
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const CSS = 'src/app/globals.css'
const VALIDATOR = 'scripts/vendor/validate_palette.js'

function ramp(prefix: string): string[] {
  const css = readFileSync(CSS, 'utf8')
  const found = [...css.matchAll(new RegExp(`--color-${prefix}-(\\d+):\\s*(#[0-9a-f]{6})`, 'gi'))]
  return found
    .map((m) => ({ index: Number(m[1]), hex: String(m[2]) }))
    .sort((a, b) => a.index - b.index)
    .map((s) => s.hex)
}

function run(label: string, palette: string[], flags: string[]): boolean {
  if (palette.length === 0) {
    console.error(`${label}: no values found in ${CSS}`)
    return false
  }
  console.log(`\n── ${label} ──`)
  try {
    const out = execFileSync('node', [VALIDATOR, palette.join(','), ...flags], {
      encoding: 'utf8',
    })
    console.log(out.trim())
    return true
  } catch (error) {
    const shell = error as { stdout?: string; stderr?: string }
    console.log((shell.stdout ?? '').trim())
    console.error((shell.stderr ?? '').trim())
    return false
  }
}

const results = [
  run('categorical', ramp('cat'), ['--mode', 'light', '--surface', '#ffffff']),
  run('ordinal', ramp('ordinal'), ['--ordinal', '--mode', 'light', '--surface', '#ffffff']),
  run('sequential', ramp('seq'), ['--ordinal', '--mode', 'light', '--surface', '#ffffff']),
]

/*
 * Dark mode is not validated because there is no dark mode. DESIGN.md is
 * explicit that its steps must be selected from these ramps and checked
 * against a dark surface, never produced by inverting these values — so there
 * is nothing here to check yet, and inventing a surface to check against
 * would make this pass mean nothing.
 */
console.log('\ndark mode: not shipped — see DESIGN.md, "Not covered yet"')

if (results.includes(false)) {
  console.error('\npalette FAILED')
  process.exit(1)
}
console.log('\npalette OK')
