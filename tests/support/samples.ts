import type { RecordType } from '@/contract/schemas'

/**
 * Minimal well-formed records, one per type. Used to prove the schema accepts
 * the shape and then to knock one field out at a time.
 *
 * Deliberately plain objects rather than typed records: these are fed to the
 * emitted JSON Schema, which is what the agent team builds against, so the
 * test must not lean on our own TypeScript types to tell it the shape is right.
 */
const envelope = {
  record_id: 'rec_001',
  site_id: 'lwas',
  source_message_id: 'msg_001',
  sent_at: '2026-09-13T19:55:00+07:00',
  sender_raw: 'Amartha',
  sender_person_id: 'p_amartha',
  confidence: 0.9,
}

const SAMPLES: Record<RecordType, () => Record<string, unknown>> = {
  message: () => ({
    ...envelope,
    text: 'Washing manual koridor area LT 2',
    photo_ids: ['ph_001'],
    reply_to_message_id: null,
    edited: false,
  }),
  work_report: () => ({
    ...envelope,
    area_id: 'koridor_lt2',
    job_text: 'Washing manual koridor area LT 2',
    photo_ids: ['ph_001', 'ph_002'],
    is_before_after: true,
    shift: 1,
    defects: [],
  }),
  complaint: () => ({
    ...envelope,
    area_id: 'toilet_lt2',
    raised_by: 'p_cristian',
    raised_at: '2026-09-13T19:55:00+07:00',
    cause: 'hk_standard',
    state: 'raised',
    state_history: [],
    closing_photo_id: null,
    blocked_reason_message_id: null,
  }),
  work_order: () => ({
    ...envelope,
    title: 'Take Out Kursi Area LDL & West Lobby',
    document_id: 'doc_003',
    requested_by: 'p_desak',
    due_date: '2026-09-10',
    state: 'raised',
    state_history: [],
    closing_photo_id: null,
    blocked_reason_message_id: null,
  }),
  lineup: () => ({
    ...envelope,
    shift: 1,
    date: '2026-09-12',
    entries: [{ area_id: 'lt2', name_raw: 'Hera', person_id: 'p_hera' }],
    total_mp: 34,
    off_day: 0,
    sakit: 0,
    alfa: 0,
    izin: 0,
  }),
  rkb_match: () => ({
    ...envelope,
    job_row_id: 'toilet:TOILET LT 2:3',
    date: '2026-09-12',
    work_report_id: 'rec_009',
    matched_by: 'agent',
  }),
  rkb_block: () => ({
    ...envelope,
    record_id: 'rbl_1',
    job_row_id: 'facade:FACADE:1',
    date: '2026-07-11',
    reason: 'car gondola not on site',
    cause: 'engineering_equipment',
  }),
  photo: () => ({
    ...envelope,
    captured_at: '2026-09-12T07:34:00+07:00',
    received_at: '2026-09-12T07:37:00+07:00',
    perceptual_hash: 'p:9f2c1a77b3e40d58',
    storage_ref: 's3://reno/lwas/ph_001.jpg',
  }),
  person: () => ({
    ...envelope,
    person_id: 'p_hera',
    canonical_name: 'Hera',
    aliases: [],
    role: 'cleaner',
    area_default: 'lt2',
    active_from: '2026-01-01',
    active_to: null,
  }),
}

export function sampleRecord(type: RecordType): Record<string, unknown> {
  return SAMPLES[type]()
}
