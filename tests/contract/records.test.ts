import { describe, expect, it } from 'vitest'
import Ajv2020 from 'ajv/dist/2020.js'
import addFormats from 'ajv-formats'
import { JSON_SCHEMAS, RECORD_TYPES, ENVELOPE_FIELDS } from '@/contract/schemas'
import { sampleRecord } from '../support/samples'

const ajv = addFormats(new Ajv2020({ strict: true, allErrors: true }))

describe('all eight record types', () => {
  it('publishes a draft 2020-12 schema for each', () => {
    expect([...RECORD_TYPES].sort()).toEqual([
      'complaint',
      'lineup',
      'message',
      'person',
      'photo',
      'rkb_match',
      'work_order',
      'work_report',
    ])
  })

  it.each(RECORD_TYPES)('accepts a well-formed %s record', (type) => {
    const validate = ajv.compile(JSON_SCHEMAS[type])
    const ok = validate(sampleRecord(type))
    expect(validate.errors ?? []).toEqual([])
    expect(ok).toBe(true)
  })

  // AC-3: the envelope is required on every type, asserted per type.
  describe.each(RECORD_TYPES)('%s envelope', (type) => {
    it.each(ENVELOPE_FIELDS)('rejects a record missing %s', (field) => {
      const validate = ajv.compile(JSON_SCHEMAS[type])
      const record = sampleRecord(type)
      delete record[field]
      expect(validate(record)).toBe(false)
    })
  })
})

describe('photo record carries what the metrics depend on', () => {
  const validate = ajv.compile(JSON_SCHEMAS.photo)

  it('keeps capture time and receive time as separate fields', () => {
    const photo = sampleRecord('photo')
    expect(photo.captured_at).not.toEqual(photo.received_at)
    expect(validate(photo)).toBe(true)
  })

  it('allows a null captured_at, because not every photo carries a Timemark stamp', () => {
    expect(validate({ ...sampleRecord('photo'), captured_at: null })).toBe(true)
  })

  it('requires received_at — without it the late-photo metric cannot exist', () => {
    const photo = sampleRecord('photo')
    delete photo.received_at
    expect(validate(photo)).toBe(false)
  })

  it('requires a perceptual hash — without it duplicate detection cannot exist', () => {
    const photo = sampleRecord('photo')
    delete photo.perceptual_hash
    expect(validate(photo)).toBe(false)
  })
})

describe('lineup record is the only attendance source', () => {
  const validate = ajv.compile(JSON_SCHEMAS.lineup)

  it('requires the absence breakdown, since each reason bills differently', () => {
    for (const field of ['off_day', 'sakit', 'alfa', 'izin', 'total_mp']) {
      const lineup = sampleRecord('lineup')
      delete lineup[field]
      expect(validate(lineup), `missing ${field}`).toBe(false)
    }
  })

  it('rejects a negative headcount', () => {
    expect(validate({ ...sampleRecord('lineup'), total_mp: -1 })).toBe(false)
  })

  it('rejects a shift outside 1..3', () => {
    expect(validate({ ...sampleRecord('lineup'), shift: 4 })).toBe(false)
  })
})

describe('rkb_match links a report to a plan cell', () => {
  const validate = ajv.compile(JSON_SCHEMAS.rkb_match)

  it('requires the job row and the date it satisfies', () => {
    for (const field of ['job_row_id', 'date']) {
      const match = sampleRecord('rkb_match')
      delete match[field]
      expect(validate(match), `missing ${field}`).toBe(false)
    }
  })

  it('records how the match was made, so an override can dispute it', () => {
    expect(validate({ ...sampleRecord('rkb_match'), matched_by: 'telepathy' })).toBe(false)
    expect(validate({ ...sampleRecord('rkb_match'), matched_by: 'human_override' })).toBe(true)
  })
})

describe('person record carries the alias table', () => {
  const validate = ajv.compile(JSON_SCHEMAS.person)

  it('accepts a person with aliases — Dame and Damme are one cleaner', () => {
    expect(validate({ ...sampleRecord('person'), aliases: ['Dame', 'Damme'] })).toBe(true)
  })

  it('requires aliases to be present even when empty, so an empty list means "checked"', () => {
    const person = sampleRecord('person')
    delete person.aliases
    expect(validate(person)).toBe(false)
  })
})
