import type { RecordType } from './schemas'

/**
 * One worked example per record type, drawn from real Living World Alam Sutera
 * traffic so the agent team recognises the shapes.
 *
 * These are injected into docs/agent-contract.md by `pnpm schema:emit`, and a
 * contract test validates every one against the emitted JSON Schema — so no
 * example in the handover document can be wrong.
 */

export const EXAMPLE_NOTES: Record<RecordType, string> = {
  message:
    'The client PIC raising the Toilet LT2 complaint on 13 Sep. Every other record cites a message like this one.',
  work_report:
    'Amartha reporting corridor washing with a before and an after shot. `area_id` is resolved; when it cannot be, send null rather than guessing.',
  complaint:
    'The same Toilet LT2 complaint as a tracked item. Answered two minutes later, never closed with a photo — so it stays `answered`, not `closed_without_photo`, until the day ends.',
  work_order:
    'A client work order that arrived as a PDF. It runs to `due_date`, never the 24-hour complaint clock.',
  lineup:
    'The shift-1 line-up. This is the only source of claimed attendance in the group, so the absence counts matter as much as the names.',
  rkb_match:
    'Links a work report to one RKB job row on one date. `matched_by` records whether the agent or a human made the link.',
  photo:
    'Captured 07:34, received 07:37. Both instants are required and separate. The hash is what makes duplicate detection possible.',
  person:
    'A cleaner with a confirmed alias. The agent proposes aliases; a human confirms them before they count.',
}

export const EXAMPLES: Record<RecordType, Record<string, unknown>> = {
  message: {
    record_id: 'msg_20260913_1955_001',
    site_id: 'lwas',
    source_message_id: 'msg_20260913_1955_001',
    sent_at: '2026-09-13T19:55:00+07:00',
    sender_raw: 'Cristian B. Suryanto',
    sender_person_id: 'p_cristian',
    confidence: 0.99,
    text: 'Malam Pak @Rachmad Adi, info Pak ada nya komplain dari customer tentang kebersihan toilet. untuk toilet disable dan toilet wanita lt.2 (dekat tenant rockstar) sangat kotor dan tidak bersih dan juga Exhaust yang ada di toilet dis…',
    photo_ids: ['ph_20260913_1955_a'],
    reply_to_message_id: null,
    edited: false,
  },
  work_report: {
    record_id: 'wr_20260912_0737_014',
    site_id: 'lwas',
    source_message_id: 'msg_20260912_0737_014',
    sent_at: '2026-09-12T07:37:00+07:00',
    sender_raw: '🥀Amartha🥀',
    sender_person_id: 'p_amartha',
    confidence: 0.93,
    area_id: 'koridor_lt2',
    job_text: 'Washing manual koridor area LT 2',
    photo_ids: ['ph_20260912_0737_a', 'ph_20260912_0737_b'],
    is_before_after: true,
    shift: 1,
    defects: [],
  },
  complaint: {
    record_id: 'cmp_20260913_001',
    site_id: 'lwas',
    source_message_id: 'msg_20260913_1955_001',
    sent_at: '2026-09-13T19:55:00+07:00',
    sender_raw: 'Cristian B. Suryanto',
    sender_person_id: 'p_cristian',
    confidence: 0.96,
    area_id: 'toilet_lt2',
    raised_by: 'p_cristian',
    raised_at: '2026-09-13T19:55:00+07:00',
    cause: 'hk_standard',
    state: 'answered',
    state_history: [
      {
        state: 'answered',
        at: '2026-09-13T19:57:00+07:00',
        source_message_id: 'msg_20260913_1957_002',
      },
    ],
    closing_photo_id: null,
    blocked_reason_message_id: null,
  },
  work_order: {
    record_id: 'wo_20260910_003',
    site_id: 'lwas',
    source_message_id: 'msg_20260910_1231_088',
    sent_at: '2026-09-10T12:31:00+07:00',
    sender_raw: 'Desak Made Meyasni',
    sender_person_id: 'p_desak',
    confidence: 0.91,
    title: 'WO to HK — Take Out Kursi Area LDL & West Lobby',
    document_id: 'doc_20260910_003',
    requested_by: 'p_desak',
    due_date: '2026-09-10',
    state: 'closed_with_photo',
    state_history: [
      {
        state: 'closed_with_photo',
        at: '2026-09-10T16:40:00+07:00',
        source_message_id: 'msg_20260910_1640_131',
      },
    ],
    closing_photo_id: 'ph_20260910_1640_a',
    blocked_reason_message_id: null,
  },
  lineup: {
    record_id: 'lu_20260912_s1',
    site_id: 'lwas',
    source_message_id: 'msg_20260912_0720_003',
    sent_at: '2026-09-12T07:20:00+07:00',
    sender_raw: '🥀Amartha🥀',
    sender_person_id: 'p_amartha',
    confidence: 0.88,
    shift: 1,
    date: '2026-09-12',
    entries: [
      { area_id: 'lt2', name_raw: 'Hera', person_id: 'p_hera' },
      { area_id: 'lt2', name_raw: 'Iska', person_id: 'p_iska' },
      { area_id: 'gf', name_raw: 'Ani', person_id: 'p_ani' },
      { area_id: 'external', name_raw: 'Renno', person_id: null },
    ],
    total_mp: 34,
    off_day: 0,
    sakit: 0,
    alfa: 0,
    izin: 0,
  },
  rkb_match: {
    record_id: 'rm_20260912_0041',
    site_id: 'lwas',
    source_message_id: 'msg_20260912_0737_014',
    sent_at: '2026-09-12T07:37:00+07:00',
    sender_raw: '🥀Amartha🥀',
    sender_person_id: 'p_amartha',
    confidence: 0.82,
    job_row_id: 'koridor_dalam:LANTAI 2:4',
    date: '2026-09-12',
    work_report_id: 'wr_20260912_0737_014',
    matched_by: 'agent',
  },
  photo: {
    record_id: 'ph_20260912_0737_a',
    site_id: 'lwas',
    source_message_id: 'msg_20260912_0737_014',
    sent_at: '2026-09-12T07:37:00+07:00',
    sender_raw: '🥀Amartha🥀',
    sender_person_id: 'p_amartha',
    confidence: 0.97,
    captured_at: '2026-09-12T07:34:00+07:00',
    received_at: '2026-09-12T07:37:00+07:00',
    perceptual_hash: 'p:9f2c1a77b3e40d58',
    storage_ref: 's3://reno-media/lwas/2026-09-12/ph_20260912_0737_a.jpg',
  },
  person: {
    record_id: 'per_p_dame',
    site_id: 'lwas',
    source_message_id: 'msg_20260912_0720_003',
    sent_at: '2026-09-12T07:20:00+07:00',
    sender_raw: '🥀Amartha🥀',
    sender_person_id: 'p_amartha',
    confidence: 0.75,
    person_id: 'p_dame',
    canonical_name: 'Dame',
    aliases: ['Damme'],
    role: 'cleaner',
    area_default: 'ug',
    active_from: '2026-01-01',
    active_to: null,
  },
}
