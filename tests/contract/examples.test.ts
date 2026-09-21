import { describe, expect, it } from 'vitest'
import Ajv2020 from 'ajv/dist/2020.js'
import addFormats from 'ajv-formats'
import { JSON_SCHEMAS, RECORD_TYPES } from '@/contract/schemas'
import { EXAMPLES, EXAMPLE_NOTES } from '@/contract/examples'

const ajv = addFormats(new Ajv2020({ strict: true, allErrors: true }))

/**
 * Every example printed in docs/agent-contract.md must validate. A wrong
 * example in a handover document is worse than no example.
 */
describe('worked examples in the handover document', () => {
  it.each(RECORD_TYPES)('%s validates against its own schema', (type) => {
    const validate = ajv.compile(JSON_SCHEMAS[type])
    const ok = validate(EXAMPLES[type])
    expect(validate.errors ?? []).toEqual([])
    expect(ok).toBe(true)
  })

  it.each(RECORD_TYPES)('%s carries an explanatory note', (type) => {
    expect(EXAMPLE_NOTES[type].length).toBeGreaterThan(20)
  })
})
