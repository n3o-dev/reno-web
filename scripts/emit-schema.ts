import { mkdirSync, writeFileSync, readFileSync } from 'node:fs'
import { RECORD_TYPES, JSON_SCHEMAS } from '../src/contract/schemas'
import { renderFieldTables, FIELDS_START, FIELDS_END } from '../src/contract/document'

/**
 * Writes the artifacts the agent team consumes:
 *  - contract/<type>.schema.json — one JSON Schema per record type
 *  - the generated field tables inside docs/specs/agent-data-contract.md
 *
 * Run with `pnpm schema:emit`. The contract tests fail if either is stale.
 */

const SPEC = 'docs/specs/agent-data-contract.md'

mkdirSync('contract', { recursive: true })
for (const type of RECORD_TYPES) {
  writeFileSync(`contract/${type}.schema.json`, `${JSON.stringify(JSON_SCHEMAS[type], null, 2)}\n`)
}

const doc = readFileSync(SPEC, 'utf8')
const start = doc.indexOf(FIELDS_START)
const end = doc.indexOf(FIELDS_END)
if (start === -1 || end === -1) {
  throw new Error(`${SPEC} is missing the ${FIELDS_START} / ${FIELDS_END} markers`)
}

const next =
  doc.slice(0, start + FIELDS_START.length) + `\n\n${renderFieldTables()}\n\n` + doc.slice(end)
writeFileSync(SPEC, next)

process.stdout.write(`emitted ${RECORD_TYPES.length} schemas and refreshed ${SPEC}\n`)
