/**
 * Builds the quotation PDF from its markdown.
 *
 *   node docs/quotation/build.mjs
 *
 * Deliberately self-contained: a commercial document should not pull a
 * markdown library into the product's dependency tree. The converter handles
 * exactly the subset this one file uses, and the file is the only input.
 *
 * Type and colour come from DESIGN.md, so the document a client holds matches
 * the dashboard it is quoting for.
 */
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'

const here = dirname(fileURLToPath(import.meta.url))

/** `node build.mjs [name.md]`. Defaults to the quotation. */
const NAME = (process.argv[2] ?? 'reno-quotation.md').replace(/\.md$/, '')
const SOURCE = join(here, `${NAME}.md`)
const OUT = join(here, `${NAME}.pdf`)

/**
 * The letterhead logo, if one has been dropped beside this script. Embedded
 * as a data URI rather than linked: the PDF has to survive being emailed on
 * its own, so it cannot depend on a file path resolving later.
 */
const LOGO_TYPES = {
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
}

const ISSUER = 'PT JAYA PIRATA DINAMIKA'

function letterhead() {
  for (const [ext, mime] of Object.entries(LOGO_TYPES)) {
    const path = join(here, `logo${ext}`)
    if (!existsSync(path)) continue
    const data = readFileSync(path).toString('base64')
    return `<div class="letterhead"><img src="data:${mime};base64,${data}" alt=""><span>${ISSUER}</span></div>`
  }
  return `<div class="letterhead"><span>${ISSUER}</span></div>`
}

const escape = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** Inline spans, applied after escaping so markup cannot be injected by content. */
function inline(text) {
  return escape(text)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[\s(])\*([^*]+)\*/g, '$1<em>$2</em>')
}

const alignOf = (cell) => {
  const c = cell.trim()
  if (c.startsWith(':') && c.endsWith(':')) return 'center'
  if (c.endsWith(':')) return 'right'
  return 'left'
}

const cells = (row) =>
  row
    .trim()
    .replace(/^\||\|$/g, '')
    .split('|')

/** A line that opens a block, so it can never be swallowed as continuation. */
function isMarker(line) {
  return /^(#{1,4}\s|---+$|>\s|::|\s*[-*]\s|\s*\d+\.\s|\s{2,}[a-z]\.\s|\|)/.test(line)
}

function render(markdown) {
  const lines = markdown.split('\n')
  const out = []
  const OPEN = { ul: '<ul>', ol: '<ol>', alpha: '<ol class="alpha">' }
  let i = 0
  let list = null
  /*
   * A lettered sub-list interrupts its parent. Without carrying the count
   * across, clause 3's sub-points would send clause 4 back to "1."
   */
  let olCount = 0
  let resumeOl = false

  const closeList = () => {
    if (list !== null) {
      out.push(list === 'ul' ? '</ul>' : '</ol>')
      list = null
    }
  }

  /** Ends every list; the next ordered list starts again at one. */
  const endLists = () => {
    closeList()
    resumeOl = false
    olCount = 0
  }

  /**
   * Closes the list but keeps its count, for a block that sits *inside* an
   * enumeration: a table between two numbered clauses interrupts the layout,
   * not the numbering.
   */
  const pauseLists = () => {
    const wasOrdered = list === 'ol'
    closeList()
    if (wasOrdered) resumeOl = true
  }

  /** Opens `kind` if a different list (or none) is open. */
  const openList = (kind) => {
    if (list === kind) return
    const wasOrdered = list === 'ol'
    closeList()
    if (kind === 'ol') {
      const start = resumeOl ? olCount + 1 : 1
      out.push(start > 1 ? `<ol start="${start}">` : OPEN.ol)
      if (!resumeOl) olCount = 0
      resumeOl = false
    } else {
      out.push(OPEN[kind])
      if (kind === 'alpha' && wasOrdered) resumeOl = true
    }
    list = kind
  }

  /**
   * A list item's wrapped lines. Without this an indented continuation became
   * its own paragraph, which closed the list: every numbered clause in a
   * contract then restarted at 1.
   */
  const continuation = (from) => {
    const parts = []
    let n = from
    while (n < lines.length && /^\s{2,}\S/.test(lines[n]) && !isMarker(lines[n])) {
      parts.push(lines[n].trim())
      n += 1
    }
    return [parts, n]
  }

  while (i < lines.length) {
    const line = lines[i]

    // A blank line separates blocks, not enumerations: a numbered clause with
    // a table under it is still the same clause list.
    if (line.trim() === '') {
      pauseLists()
      i += 1
      continue
    }

    // A table: a header row, a delimiter row, then body rows.
    if (line.trim().startsWith('|') && (lines[i + 1] ?? '').includes('---')) {
      pauseLists()
      const head = cells(line)
      const aligns = cells(lines[i + 1]).map(alignOf)
      const body = []
      i += 2
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        body.push(cells(lines[i]))
        i += 1
      }
      /*
       * Right-aligned columns hold money. They are marked so the stylesheet
       * can stop them wrapping: "Rp 36.000.000" breaking after "Rp" is the
       * one defect a reader of an invoice is guaranteed to notice.
       */
      const cell = (tag, c, n) => {
        const align = aligns[n] ?? 'left'
        const cls = align === 'right' ? ' class="num"' : ''
        return `<${tag}${cls} style="text-align:${align}">${inline(c.trim())}</${tag}>`
      }
      const th = head.map((c, n) => cell('th', c, n)).join('')
      const rows = body
        .map((r) => `<tr>${r.map((c, n) => cell('td', c, n)).join('')}</tr>`)
        .join('')
      const headless = head.every((c) => c.trim() === '')
      out.push(
        `<table>${headless ? '' : `<thead><tr>${th}</tr></thead>`}<tbody>${rows}</tbody></table>`,
      )
      continue
    }

    const heading = /^(#{1,4})\s+(.*)$/.exec(line)
    if (heading !== null) {
      endLists()
      const level = heading[1].length
      out.push(`<h${level}>${inline(heading[2])}</h${level}>`)
      i += 1
      continue
    }

    if (/^---+$/.test(line.trim())) {
      endLists()
      out.push('<hr>')
      i += 1
      continue
    }

    if (line.trim() === '<br>') {
      endLists()
      out.push('<div class="spacer"></div>')
      i += 1
      continue
    }

    /*
     * `::signature <salam>|<perusahaan>|<nama>|<jabatan>` renders the closing
     * block: the whole thing sits right, with room between the company name
     * and the rule for a materai and a signature across it.
     */
    const signature = /^::signature\s+(.+)$/.exec(line.trim())
    if (signature !== null) {
      endLists()
      const [salam = '', perusahaan = '', nama = '', jabatan = ''] = signature[1]
        .split('|')
        .map((part) => part.trim())
      out.push(
        `<div class="sign">` +
          `<div class="sign-salam">${inline(salam)}</div>` +
          `<div class="sign-company">${inline(perusahaan)}</div>` +
          `<div class="sign-space"></div>` +
          `<div class="sign-name">${inline(nama)}</div>` +
          `<div class="sign-role">${inline(jabatan)}</div>` +
          `</div>`,
      )
      i += 1
      continue
    }

    /*
     * `::signatures <label>|<perusahaan>|<nama>|<jabatan> || <same again>`
     * puts two signing parties side by side, which is what a contract needs.
     */
    const parties = /^::signatures\s+(.+)$/.exec(line.trim())
    if (parties !== null) {
      endLists()
      const columns = parties[1]
        .split('||')
        .map((party) => {
          const [label = '', perusahaan = '', nama = '', jabatan = ''] = party
            .split('|')
            .map((part) => part.trim())
          return (
            `<div>` +
            `<div class="sign-salam">${inline(label)}</div>` +
            `<div class="sign-company">${inline(perusahaan)}</div>` +
            `<div class="sign-space"></div>` +
            `<div class="sign-name">${inline(nama)}</div>` +
            `<div class="sign-role">${inline(jabatan)}</div>` +
            `</div>`
          )
        })
        .join('')
      out.push(`<div class="signs">${columns}</div>`)
      i += 1
      continue
    }

    if (line.startsWith('> ')) {
      endLists()
      const quote = []
      while (i < lines.length && lines[i].startsWith('> ')) {
        quote.push(lines[i].slice(2))
        i += 1
      }
      out.push(`<blockquote>${inline(quote.join(' '))}</blockquote>`)
      continue
    }

    const bullet = /^\s*[-*]\s+(.*)$/.exec(line)
    if (bullet !== null) {
      openList('ul')
      const [rest, next] = continuation(i + 1)
      out.push(`<li>${inline([bullet[1], ...rest].join(' '))}</li>`)
      i = next
      continue
    }

    // Lettered sub-clauses: `   a. ...` under a numbered clause.
    const lettered = /^\s{2,}[a-z]\.\s+(.*)$/.exec(line)
    if (lettered !== null) {
      openList('alpha')
      const [rest, next] = continuation(i + 1)
      out.push(`<li>${inline([lettered[1], ...rest].join(' '))}</li>`)
      i = next
      continue
    }

    const numbered = /^\s*\d+\.\s+(.*)$/.exec(line)
    if (numbered !== null) {
      openList('ol')
      olCount += 1
      const [rest, next] = continuation(i + 1)
      out.push(`<li>${inline([numbered[1], ...rest].join(' '))}</li>`)
      i = next
      continue
    }

    // Paragraph: consume until a blank line or a block opener.
    endLists()
    const para = []
    while (i < lines.length && lines[i].trim() !== '' && !isMarker(lines[i])) {
      para.push(lines[i].trim())
      i += 1
    }
    if (para.length > 0) out.push(`<p>${inline(para.join(' '))}</p>`)
  }

  closeList()
  return out.join('\n')
}

const HTML = (body) => `<!doctype html>
<html lang="id"><head><meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&family=Space+Grotesk:wght@500;700&display=swap" rel="stylesheet">
<style>
  :root {
    --ink: #1D1409; --muted: #6f6558; --faint: #8d8377;
    --cream: #F4E3D0; --accent: #4B3D2E; --line: #DFDEDD; --plane: #f7f5f2;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0; color: var(--ink); background: #fff;
    font-family: "DM Sans", system-ui, -apple-system, sans-serif;
    font-size: 10.5pt; line-height: 1.55;
    -webkit-font-smoothing: antialiased;
  }
  h1, h2, h3, h4 { font-family: "Space Grotesk", system-ui, sans-serif; font-weight: 700; }
  h1 { font-size: 23pt; line-height: 1.15; letter-spacing: -0.02em; margin: 0 0 2mm; }
  h2 {
    font-size: 13pt; line-height: 1.25; letter-spacing: -0.005em;
    margin: 9mm 0 3mm; padding-bottom: 1.5mm; border-bottom: 1.5px solid var(--ink);
  }
  h3 { font-size: 11pt; margin: 6mm 0 2mm; color: var(--accent); }
  h1 + p { margin-top: 0; }
  p { margin: 0 0 3mm; }
  strong { font-weight: 700; }
  code {
    font-family: ui-monospace, "SF Mono", Menlo, monospace;
    font-size: 0.86em; background: var(--plane);
    border: 1px solid var(--line); border-radius: 2px; padding: 0.5mm 1.2mm;
    color: var(--accent);
  }
  hr { border: 0; border-top: 1px solid var(--line); margin: 7mm 0; }
  ul, ol { margin: 0 0 3mm; padding-left: 5.5mm; }
  ol.alpha { list-style-type: lower-alpha; margin-left: 5mm; margin-bottom: 2mm; }
  li { margin-bottom: 1.5mm; }
  blockquote {
    margin: 0 0 4mm; padding: 3mm 4mm;
    background: var(--cream); border-radius: 2mm;
    font-size: 10pt;
  }
  table {
    width: 100%; border-collapse: collapse; margin: 0 0 4mm;
    font-size: 9.5pt; page-break-inside: avoid;
  }
  th {
    font-size: 8.5pt; letter-spacing: 0.04em; text-transform: uppercase;
    color: var(--muted); font-weight: 500;
    border-bottom: 1px solid var(--ink); padding: 2mm 2.5mm; vertical-align: bottom;
  }
  td { padding: 2mm 2.5mm; border-bottom: 1px solid var(--line); vertical-align: top; }
  tbody tr:last-child td { border-bottom: 1px solid var(--line); }
  .letterhead {
    display: flex; align-items: center; gap: 4mm;
    margin: 0 0 8mm; padding-bottom: 4mm; border-bottom: 1px solid var(--line);
  }
  .letterhead img { height: 13mm; width: auto; display: block; }
  .letterhead span {
    font-family: "Space Grotesk", system-ui, sans-serif;
    font-weight: 700; font-size: 11.5pt; letter-spacing: 0.06em;
    color: var(--ink);
  }
  .num { white-space: nowrap; font-variant-numeric: tabular-nums; }
  .sign {
    width: 62mm; margin: 12mm 0 0 auto; text-align: center;
    page-break-inside: avoid;
  }
  .signs {
    display: flex; gap: 12mm; margin-top: 10mm;
    page-break-inside: avoid; text-align: center;
  }
  .signs > div { flex: 1; }
  .sign-salam { margin-bottom: 1.5mm; }
  .sign-company { font-weight: 700; letter-spacing: 0.03em; }
  /* Room for the materai and a signature across it, as they are stuck in practice. */
  .sign-space { height: 32mm; }
  .sign-name {
    border-top: 1px solid var(--ink); padding-top: 2mm;
    font-weight: 700; letter-spacing: 0.04em;
  }
  .sign-role { font-size: 9pt; color: var(--muted); letter-spacing: 0.06em; }
  .spacer { height: 6mm; }
  h2, h3 { page-break-after: avoid; }
</style></head>
<body>${letterhead()}${body}</body></html>`

/*
 * Prefer the Chrome already on the machine. Playwright's own build is a
 * 150 MB download that this repository has no other use for, and the output
 * is a PDF — a print engine, not a test surface, so the exact build does not
 * matter.
 */
async function launch() {
  try {
    return await chromium.launch({ channel: 'chrome' })
  } catch {
    return await chromium.launch()
  }
}

/** The document's own number, read from its `Nomor` row, for the footer. */
function documentNumber(markdown) {
  const row = /\|\s*\*\*Nomor\*\*\s*\|\s*([^|]+?)\s*\|/.exec(markdown)
  return row === null ? '' : row[1]
}

const browser = await launch()
try {
  const markdown = readFileSync(SOURCE, 'utf8')
  const page = await browser.newPage()
  await page.setContent(HTML(render(markdown)), { waitUntil: 'networkidle' })
  const number = documentNumber(markdown)
  await page.pdf({
    path: OUT,
    format: 'A4',
    printBackground: true,
    margin: { top: '18mm', bottom: '20mm', left: '18mm', right: '18mm' },
    displayHeaderFooter: true,
    headerTemplate: '<div></div>',
    footerTemplate:
      '<div style="width:100%;padding:0 18mm;font-family:DM Sans,sans-serif;font-size:7.5pt;color:#8d8377;display:flex;justify-content:space-between">' +
      `<span>${number} · PT Jaya Pirata Dinamika</span>` +
      '<span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>',
  })
  process.stdout.write(`wrote ${OUT}\n`)
} finally {
  await browser.close()
}
