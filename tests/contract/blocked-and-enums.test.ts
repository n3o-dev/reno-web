import { describe, expect, it } from 'vitest'
import Ajv2020 from 'ajv/dist/2020.js'
import addFormats from 'ajv-formats'
import { JSON_SCHEMAS } from '@/contract/schemas'

const ajv = addFormats(new Ajv2020({ strict: true, allErrors: true }))

const base = {
  record_id: 'cmp_001',
  site_id: 'lwas',
  source_message_id: 'msg_412',
  sent_at: '2026-09-13T19:55:00+07:00',
  sender_raw: 'Cristian B. Suryanto',
  sender_person_id: 'p_cristian',
  confidence: 0.94,
}

function complaint(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    ...base,
    area_id: 'toilet_lt2',
    raised_by: 'p_cristian',
    raised_at: '2026-09-13T19:55:00+07:00',
    cause: 'hk_standard',
    state: 'raised',
    state_history: [],
    closing_photo_id: null,
    blocked_reason_message_id: null,
    ...over,
  }
}

function workOrder(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    ...base,
    record_id: 'wo_001',
    title: 'Take Out Kursi Area LDL & West Lobby',
    document_id: 'doc_003',
    requested_by: 'p_desak',
    due_date: '2026-09-10',
    state: 'raised',
    state_history: [],
    closing_photo_id: null,
    blocked_reason_message_id: null,
    ...over,
  }
}

describe('closed enums', () => {
  it('accepts every declared cause', () => {
    const validate = ajv.compile(JSON_SCHEMAS.complaint)
    for (const cause of [
      'hk_standard',
      'tenant_project_event',
      'engineering_equipment',
      'spill',
      'external_other',
    ]) {
      expect(validate(complaint({ cause })), `cause ${cause}`).toBe(true)
    }
  })

  it('rejects a cause outside the enum rather than coercing it', () => {
    const validate = ajv.compile(JSON_SCHEMAS.complaint)
    expect(validate(complaint({ cause: 'not_our_fault' }))).toBe(false)
  })

  it('rejects a state outside the enum', () => {
    const validate = ajv.compile(JSON_SCHEMAS.complaint)
    expect(validate(complaint({ state: 'probably_done' }))).toBe(false)
  })
})

describe('a blocked record must cite the message that justifies it', () => {
  it('accepts blocked when a citation is present', () => {
    const validate = ajv.compile(JSON_SCHEMAS.complaint)
    const ok = validate(complaint({ state: 'blocked', blocked_reason_message_id: 'msg_388' }))
    expect(validate.errors ?? []).toEqual([])
    expect(ok).toBe(true)
  })

  it('rejects blocked with a null citation — an uncited block is invalid input, not a zero-duration block', () => {
    const validate = ajv.compile(JSON_SCHEMAS.complaint)
    expect(validate(complaint({ state: 'blocked', blocked_reason_message_id: null }))).toBe(false)
  })

  it('rejects blocked with the citation key absent entirely', () => {
    const validate = ajv.compile(JSON_SCHEMAS.complaint)
    const record = complaint({ state: 'blocked' })
    delete record.blocked_reason_message_id
    expect(validate(record)).toBe(false)
  })

  it('applies the same rule to work orders', () => {
    const validate = ajv.compile(JSON_SCHEMAS.work_order)
    expect(validate(workOrder({ state: 'blocked', blocked_reason_message_id: null }))).toBe(false)
    expect(validate(workOrder({ state: 'blocked', blocked_reason_message_id: 'msg_388' }))).toBe(
      true,
    )
  })

  it('still allows a citation on a non-blocked record, since a block can be lifted', () => {
    const validate = ajv.compile(JSON_SCHEMAS.complaint)
    expect(
      validate(complaint({ state: 'in_progress', blocked_reason_message_id: 'msg_388' })),
    ).toBe(true)
  })
})

describe('work orders run to a due date, not the complaint clock', () => {
  it('requires a due_date', () => {
    const validate = ajv.compile(JSON_SCHEMAS.work_order)
    const record = workOrder()
    delete record.due_date
    expect(validate(record)).toBe(false)
  })

  it('has no due_date on a complaint — its clock comes from raised_at', () => {
    const validate = ajv.compile(JSON_SCHEMAS.complaint)
    expect(validate(complaint({ due_date: '2026-09-14' }))).toBe(false)
  })
})
