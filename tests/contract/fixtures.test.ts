import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import Ajv2020 from 'ajv/dist/2020.js'
import addFormats from 'ajv-formats'
import { JSON_SCHEMAS, RECORD_TYPES } from '@/contract/schemas'

const ajv = addFormats(new Ajv2020({ strict: true, allErrors: true }))

/**
 * AC-1: `pnpm test:contract` validates every file under fixtures/agent/
 * against the emitted schema. This lives in tests/contract/ on purpose — it
 * must run under test:contract, not only under test:fixtures.
 */
describe('every committed fixture validates against the emitted schema', () => {
  it.each(RECORD_TYPES)('fixtures/agent/%s.json', (type) => {
    const validate = ajv.compile(JSON_SCHEMAS[type])
    const parsed: unknown = JSON.parse(readFileSync(`fixtures/agent/${type}.json`, 'utf8'))
    expect(Array.isArray(parsed)).toBe(true)
    const records = parsed as unknown[]
    expect(records.length).toBeGreaterThan(0)

    const failures = records
      .map((record, index) => (validate(record) ? null : { index, errors: validate.errors }))
      .filter((f) => f !== null)
    expect(failures.slice(0, 3)).toEqual([])
  })
})
