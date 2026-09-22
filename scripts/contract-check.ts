/**
 * Validates a file of records against the contract, for the agent team.
 *
 * `pnpm contract:check their-output.json`
 *
 * The file is either an array of records with a `type`, or the exact body
 * `POST /api/records` takes. Everything the endpoint would reject is
 * reported here, with the index and the field — so the agent team can find
 * out on their own machine rather than from a 422 in production.
 */
import { readFile } from 'node:fs/promises'
import { z } from 'zod'
import { RECORD_TYPES, zodSchemas, type RecordType } from '@/contract/schemas'

const entry = z.object({ type: z.string(), payload: z.unknown() })
const body = z.union([z.array(entry), z.object({ records: z.array(entry) })])

const [file] = process.argv.slice(2)
if (file === undefined) {
  console.error('usage: pnpm contract:check <file.json>')
  console.error('  the file holds [{ "type": "complaint", "payload": { … } }, …]')
  console.error('  or { "records": [ … ] } — the same body the endpoint takes')
  process.exit(1)
}

const raw: unknown = JSON.parse(await readFile(file, 'utf8'))
const parsed = body.safeParse(raw)
if (!parsed.success) {
  console.error(`${file} is not a list of records: expected [{type, payload}] or {records: [...]}`)
  process.exit(1)
}

const records = Array.isArray(parsed.data) ? parsed.data : parsed.data.records
const problems: string[] = []
const counts = new Map<string, number>()

records.forEach((record, index) => {
  counts.set(record.type, (counts.get(record.type) ?? 0) + 1)

  if (!RECORD_TYPES.includes(record.type as RecordType)) {
    problems.push(`[${index}] unknown type "${record.type}" — one of: ${RECORD_TYPES.join(', ')}`)
    return
  }
  const result = zodSchemas[record.type as RecordType].safeParse(record.payload)
  if (result.success) return
  for (const issue of result.error.issues.slice(0, 3)) {
    problems.push(`[${index}] ${record.type}.${issue.path.join('.') || '(root)'}: ${issue.message}`)
  }
})

console.log(`${records.length} records: ${[...counts].map(([t, n]) => `${t} ${n}`).join(', ')}`)

if (problems.length > 0) {
  console.error(`\n${problems.length} problem(s):`)
  for (const problem of problems) console.error(`  ${problem}`)
  console.error('\nFix these and the endpoint will accept the batch.')
  process.exit(1)
}
console.log('every record matches the contract.')
