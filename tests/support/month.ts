import { complaintRecord, type ComplaintRecord } from '@/contract/schemas'
import type { MonthInput } from '@/rules/month'

/** A small, complete month used to exercise the rules layer end to end. */
export function sampleMonth(): MonthInput {
  const complaints: ComplaintRecord[] = [0, 1, 2].map((n) =>
    complaintRecord.parse({
      record_id: `cmp_${n}`,
      site_id: 'lwas',
      source_message_id: `msg_${n}`,
      sent_at: '2026-09-13T19:55:00+07:00',
      sender_raw: 'Cristian B. Suryanto',
      sender_person_id: null,
      confidence: 0.9,
      area_id: 'toilet_lt2',
      raised_by: 'p_cristian',
      raised_at: '2026-09-13T19:55:00+07:00',
      cause: 'hk_standard',
      state: n === 0 ? 'closed_with_photo' : 'answered',
      state_history: [
        { state: 'answered', at: '2026-09-13T19:57:00+07:00', source_message_id: `msg_${n}a` },
        ...(n === 0
          ? [{ state: 'closed_with_photo', at: '2026-09-13T20:36:00+07:00', source_message_id: `msg_${n}c` }]
          : []),
      ],
      closing_photo_id: n === 0 ? 'ph_1' : null,
      blocked_reason_message_id: null,
    }),
  )

  const cells = [
    { job_row_id: 'toilet:1', date: '2026-09-10', planned: true, done: true, blocked: false },
    { job_row_id: 'toilet:2', date: '2026-09-11', planned: true, done: false, blocked: true },
    { job_row_id: 'carpark:1', date: '2026-09-11', planned: true, done: true, blocked: false },
  ]

  const billing = {
    contracts: [{ slot_id: 'gf_s1', area_id: 'gf', shift: 1 as const, contracted: 8 }],
    days: ['2026-09-10', '2026-09-11'].map((date) => ({
      slot_id: 'gf_s1',
      date,
      names: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'],
      absences: [],
    })),
    monthlyRatePerMp: 4_250_000,
  }

  const realisation = {
    planned: 3,
    done: 2,
    blocked: 1,
    gross: 2 / 3,
    net: 1,
    evidence: ['toilet:1@2026-09-10', 'toilet:2@2026-09-11', 'carpark:1@2026-09-11'],
  }

  return {
    complaints,
    cells,
    billing,
    rapor: {
      realisation,
      complaints: { raised: 3, closedUnder24h: 1, repeatAreas: 1, clientIssuedSp: false },
      attendance: { unfilledSlotDays: 0 },
      reports: { total: 639, passed: 578, beforeAfter: 61, duplicatePhotos: 3 },
    },
  }
}
