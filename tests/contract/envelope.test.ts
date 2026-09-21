import { describe, expect, it } from 'vitest'
import Ajv2020 from 'ajv/dist/2020.js'
import addFormats from 'ajv-formats'
import { JSON_SCHEMAS, RECORD_TYPES, ENVELOPE_FIELDS } from '@/contract/schemas'

const ajv = addFormats(new Ajv2020({ strict: true, allErrors: true }))

function validMessage(): Record<string, unknown> {
  return {
    record_id: 'msg_001',
    site_id: 'lwas',
    source_message_id: 'msg_001',
    sent_at: '2026-09-13T19:55:00+07:00',
    sender_raw: 'Cristian B. Suryanto',
    sender_person_id: null,
    confidence: 0.98,
    text: 'Malam Pak, ada komplain dari customer tentang kebersihan toilet.',
    photo_ids: [],
    reply_to_message_id: null,
    edited: false,
  }
}

describe('record contract envelope', () => {
  it('publishes a JSON Schema for the message record', () => {
    expect(RECORD_TYPES).toContain('message')
    expect(JSON_SCHEMAS.message).toBeDefined()
    expect(JSON_SCHEMAS.message.$schema).toBe('https://json-schema.org/draft/2020-12/schema')
  })

  it('accepts a well-formed message record', () => {
    const validate = ajv.compile(JSON_SCHEMAS.message)
    const ok = validate(validMessage())
    expect(validate.errors ?? []).toEqual([])
    expect(ok).toBe(true)
  })

  // AC-3: the envelope is mandatory on every record type.
  it.each(ENVELOPE_FIELDS)('rejects a message record missing %s', (field) => {
    const validate = ajv.compile(JSON_SCHEMAS.message)
    const record = validMessage()
    delete record[field]
    expect(validate(record)).toBe(false)
  })

  it('rejects a confidence outside 0..1', () => {
    const validate = ajv.compile(JSON_SCHEMAS.message)
    expect(validate({ ...validMessage(), confidence: 1.4 })).toBe(false)
  })

  it('rejects an unknown property so the agent cannot smuggle undeclared fields', () => {
    const validate = ajv.compile(JSON_SCHEMAS.message)
    expect(validate({ ...validMessage(), mystery_field: 'x' })).toBe(false)
  })
})
