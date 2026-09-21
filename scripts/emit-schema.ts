import { mkdirSync, writeFileSync, readFileSync } from 'node:fs'
import { RECORD_TYPES, JSON_SCHEMAS } from '../src/contract/schemas'
import {
  renderFieldTables,
  renderExamples,
  FIELDS_START,
  FIELDS_END,
  EXAMPLES_START,
  EXAMPLES_END,
} from '../src/contract/document'

/**
 * Writes the artifacts the agent team consumes:
 *  - contract/<type>.schema.json — one JSON Schema per record type
 *  - the generated field tables inside docs/specs/agent-data-contract.md
 *
 * Run with `pnpm schema:emit`. The contract tests fail if either is stale.
 */

const SPEC = 'docs/specs/agent-data-contract.md'
const HANDOVER = 'docs/agent-contract.md'

mkdirSync('contract', { recursive: true })
for (const type of RECORD_TYPES) {
  writeFileSync(`contract/${type}.schema.json`, `${JSON.stringify(JSON_SCHEMAS[type], null, 2)}\n`)
}

/** Replaces the content between two markers, leaving the markers in place. */
function inject(path: string, start: string, end: string, body: string): void {
  const doc = readFileSync(path, 'utf8')
  const from = doc.indexOf(start)
  const to = doc.indexOf(end)
  if (from === -1 || to === -1) throw new Error(`${path} is missing its ${start} / ${end} markers`)
  writeFileSync(path, doc.slice(0, from + start.length) + `\n\n${body}\n\n` + doc.slice(to))
}

inject(SPEC, FIELDS_START, FIELDS_END, renderFieldTables())
inject(HANDOVER, FIELDS_START, FIELDS_END, renderFieldTables())
inject(HANDOVER, EXAMPLES_START, EXAMPLES_END, renderExamples())

process.stdout.write(
  `emitted ${RECORD_TYPES.length} schemas, refreshed ${SPEC} and ${HANDOVER}\n`,
)
