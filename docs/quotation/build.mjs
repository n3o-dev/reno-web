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
const SOURCE = join(here, 'reno-quotation.md')
const OUT = join(here, 'reno-quotation.pdf')

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

function logo() {
  for (const [ext, mime] of Object.entries(LOGO_TYPES)) {
    const path = join(here, `logo${ext}`)
    if (!existsSync(path)) continue
    const data = readFileSync(path).toString('base64')
    return `<img class="logo" src="data:${mime};base64,${data}" alt="">`
  }
  return ''
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

function render(markdown) {
  const lines = markdown.split('\n')
  const out = []
  let i = 0
  let list = null

  const closeList = () => {
    if (list !== null) {
      out.push(`</${list}>`)
      list = null
    }
  }

  while (i < lines.length) {
    const line = lines[i]

    if (line.trim() === '') {
      closeList()
      i += 1
      continue
    }

    // A table: a header row, a delimiter row, then body rows.
    if (line.trim().startsWith('|') && (lines[i + 1] ?? '').includes('---')) {
      closeList()
      const head = cells(line)
      const aligns = cells(lines[i + 1]).map(alignOf)
      const body = []
      i += 2
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        body.push(cells(lines[i]))
        i += 1
      }
      const th = head
        .map((c, n) => `<th style="text-align:${aligns[n] ?? 'left'}">${inline(c.trim())}</th>`)
        .join('')
      const rows = body
        .map(
          (r) =>
            `<tr>${r
              .map((c, n) => `<td style="text-align:${aligns[n] ?? 'left'}">${inline(c.trim())}</td>`)
              .join('')}</tr>`,
        )
        .join('')
      const headless = head.every((c) => c.trim() === '')
      out.push(
        `<table>${headless ? '' : `<thead><tr>${th}</tr></thead>`}<tbody>${rows}</tbody></table>`,
      )
      continue
    }

    const heading = /^(#{1,4})\s+(.*)$/.exec(line)
    if (heading !== null) {
      closeList()
      const level = heading[1].length
      out.push(`<h${level}>${inline(heading[2])}</h${level}>`)
      i += 1
      continue
    }

    if (/^---+$/.test(line.trim())) {
      closeList()
      out.push('<hr>')
      i += 1
      continue
    }

    if (line.trim() === '<br>') {
      closeList()
      out.push('<div class="spacer"></div>')
      i += 1
      continue
    }

    if (line.startsWith('> ')) {
      closeList()
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
      if (list !== 'ul') {
        closeList()
        out.push('<ul>')
        list = 'ul'
      }
      const item = [bullet[1]]
      i += 1
      while (i < lines.length && /^\s{2,}\S/.test(lines[i]) && !/^\s*[-*]\s/.test(lines[i])) {
        item.push(lines[i].trim())
        i += 1
      }
      out.push(`<li>${inline(item.join(' '))}</li>`)
      continue
    }

    const numbered = /^\s*(\d+)\.\s+(.*)$/.exec(line)
    if (numbered !== null) {
      if (list !== 'ol') {
        closeList()
        out.push('<ol>')
        list = 'ol'
      }
      out.push(`<li>${inline(numbered[2])}</li>`)
      i += 1
      continue
    }

    // Paragraph: consume until a blank line or a block opener.
    closeList()
    const para = []
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !/^(#{1,4}\s|---+$|>\s|\s*[-*]\s|\s*\d+\.\s|\|)/.test(lines[i])
    ) {
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
  .logo { height: 13mm; width: auto; display: block; margin: 0 0 7mm; }
  .spacer { height: 6mm; }
  h2, h3 { page-break-after: avoid; }
</style></head>
<body>${logo()}${body}</body></html>`

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

const browser = await launch()
try {
  const page = await browser.newPage()
  await page.setContent(HTML(render(readFileSync(SOURCE, 'utf8'))), { waitUntil: 'networkidle' })
  await page.pdf({
    path: OUT,
    format: 'A4',
    printBackground: true,
    margin: { top: '18mm', bottom: '20mm', left: '18mm', right: '18mm' },
    displayHeaderFooter: true,
    headerTemplate: '<div></div>',
    footerTemplate:
      '<div style="width:100%;padding:0 18mm;font-family:DM Sans,sans-serif;font-size:7.5pt;color:#8d8377;display:flex;justify-content:space-between">' +
      '<span>Penawaran Harga · 021/JDP/Quot/09/2026 · PT Jaya Pirata Dinamika</span>' +
      '<span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>',
  })
  process.stdout.write(`wrote ${OUT}\n`)
} finally {
  await browser.close()
}
