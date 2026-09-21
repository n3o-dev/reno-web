import { describe, expect, it } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { RECORD_TYPES, JSON_SCHEMAS } from '@/contract/schemas'
import {
  renderFieldTables,
  renderExamples,
  FIELDS_START,
  FIELDS_END,
  EXAMPLES_START,
  EXAMPLES_END,
} from '@/contract/document'

const SPEC = 'docs/specs/agent-data-contract.md'

describe('the contract document is generated, not maintained by hand', () => {
  const doc = readFileSync(SPEC, 'utf8')

  it('carries a generated field section', () => {
    expect(doc).toContain(FIELDS_START)
    expect(doc).toContain(FIELDS_END)
  })

  // AC-7: fails the moment a schema changes and the document is not regenerated.
  it('is in sync with the schemas', () => {
    const between = doc.slice(doc.indexOf(FIELDS_START) + FIELDS_START.length, doc.indexOf(FIELDS_END))
    expect(between.trim()).toBe(renderFieldTables().trim())
  })

  it('names every record type and every field of each', () => {
    const rendered = renderFieldTables()
    for (const type of RECORD_TYPES) {
      expect(rendered).toContain(`### \`${type}\``)
      const schema = JSON_SCHEMAS[type]
      for (const field of fieldNamesOf(schema)) {
        expect(rendered, `${type}.${field}`).toContain(`\`${field}\``)
      }
    }
  })

  it('states nullability and enums where they apply', () => {
    const rendered = renderFieldTables()
    // sender_person_id is the canonical nullable; cause is the canonical enum.
    expect(rendered).toMatch(/sender_person_id[^\n]*yes/)
    expect(rendered).toContain('hk_standard')
  })
})

describe('the JSON Schema files the agent team consumes', () => {
  it.each(RECORD_TYPES)('exists on disk for %s and matches the emitted schema', (type) => {
    const path = `contract/${type}.schema.json`
    expect(existsSync(path), `${path} missing — run pnpm schema:emit`).toBe(true)
    expect(JSON.parse(readFileSync(path, 'utf8'))).toEqual(JSON_SCHEMAS[type])
  })
})

function fieldNamesOf(schema: Record<string, unknown>): string[] {
  const names = new Set<string>()
  const walk = (node: unknown): void => {
    if (typeof node !== 'object' || node === null) return
    const obj = node as Record<string, unknown>
    if (obj.properties && typeof obj.properties === 'object') {
      for (const key of Object.keys(obj.properties)) names.add(key)
    }
    for (const branch of ['anyOf', 'oneOf', 'allOf']) {
      const arr = obj[branch]
      if (Array.isArray(arr)) arr.forEach(walk)
    }
  }
  walk(schema)
  return [...names]
}

describe('the handover document sent to the agent team', () => {
  const doc = readFileSync('docs/agent-contract.md', 'utf8')
  const between = (start: string, end: string): string =>
    doc.slice(doc.indexOf(start) + start.length, doc.indexOf(end)).trim()

  it('carries generated field tables that are in sync', () => {
    expect(between(FIELDS_START, FIELDS_END)).toBe(renderFieldTables().trim())
  })

  it('carries generated examples that are in sync', () => {
    expect(between(EXAMPLES_START, EXAMPLES_END)).toBe(renderExamples().trim())
  })

  it('states every binding rule the dashboard depends on', () => {
    for (const rule of [
      'blocked record must cite',
      'closed sets',
      'separate instants',
      'perceptual hash',
      'different clocks',
      'state_history',
      'guess an area',
    ]) {
      expect(doc.toLowerCase()).toContain(rule.toLowerCase())
    }
  })

  it('tells the agent team how to validate their own output', () => {
    expect(doc).toContain('contract/')
    expect(doc).toContain('ajv')
  })
})
