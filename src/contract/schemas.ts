import { z } from 'zod'

/**
 * The record contract the dashboard consumes from the Reno AI agent.
 *
 * Zod is the single source of truth: it gives the dashboard its TypeScript
 * types, and `JSON_SCHEMAS` is emitted from the same definitions so the
 * artifact handed to the agent team can never drift from what we validate.
 *
 * See docs/specs/agent-data-contract.md
 */

/**
 * Required on every record type, whatever it carries.
 * `sender_person_id` is mandatory but nullable — the agent must say it could
 * not resolve a person rather than omit the field.
 */
export const ENVELOPE_FIELDS = [
  'record_id',
  'site_id',
  'source_message_id',
  'sent_at',
  'sender_raw',
  'confidence',
] as const

export type EnvelopeField = (typeof ENVELOPE_FIELDS)[number]

const envelope = {
  record_id: z.string().min(1),
  site_id: z.string().min(1),
  /** The message this record was derived from. Every figure traces back through it. */
  source_message_id: z.string().min(1),
  /** ISO 8601 with offset — Reno operates in WIB and the offset must survive. */
  sent_at: z.iso.datetime({ offset: true }),
  sender_raw: z.string().min(1),
  /** Null when the agent could not resolve the raw name to a person. */
  sender_person_id: z.string().min(1).nullable(),
  /** How sure the agent is. Low-confidence records are rendered differently, never dropped. */
  confidence: z.number().min(0).max(1),
}

/** The raw group message. The spine every other record cites. */
export const messageRecord = z.strictObject({
  ...envelope,
  text: z.string(),
  photo_ids: z.array(z.string().min(1)),
  reply_to_message_id: z.string().min(1).nullable(),
  edited: z.boolean(),
})

/** Closed set. Anything outside it is rejected at ingest, never coerced. */
export const CAUSES = [
  'hk_standard',
  'tenant_project_event',
  'engineering_equipment',
  'spill',
  'external_other',
] as const

/** Closed set, shared by complaints and work orders. */
export const LIFECYCLE_STATES = [
  'raised',
  'answered',
  'in_progress',
  'blocked',
  'closed_with_photo',
  'closed_without_photo',
] as const

/** Every state except `blocked`. Declared, not filtered, so it needs no assertion. */
const UNBLOCKED_STATES = [
  'raised',
  'answered',
  'in_progress',
  'closed_with_photo',
  'closed_without_photo',
] as const satisfies readonly Exclude<(typeof LIFECYCLE_STATES)[number], 'blocked'>[]

const stateHistoryEntry = z.strictObject({
  state: z.enum(LIFECYCLE_STATES),
  at: z.iso.datetime({ offset: true }),
  source_message_id: z.string().min(1),
})

/**
 * A trackable item is a union of two genuine shapes, not one shape with a
 * refinement: a blocked record REQUIRES the message that justifies the block.
 *
 * Modelled as a union deliberately. Zod refinements do not survive
 * `toJSONSchema`, so a refinement would enforce the rule for us and silently
 * drop it from the artifact the agent team builds against. A union emits
 * `anyOf` and keeps the rule enforceable on both sides.
 */
function trackable<T extends z.ZodRawShape>(fields: T) {
  const common = {
    ...envelope,
    ...fields,
    state_history: z.array(stateHistoryEntry),
    closing_photo_id: z.string().min(1).nullable(),
  }
  return z.union([
    z.strictObject({
      ...common,
      state: z.enum(UNBLOCKED_STATES),
      blocked_reason_message_id: z.string().min(1).nullable(),
    }),
    z.strictObject({
      ...common,
      state: z.literal('blocked'),
      blocked_reason_message_id: z.string().min(1),
    }),
  ])
}

/** A complaint runs a 24-hour clock from `raised_at`. */
export const complaintRecord = trackable({
  area_id: z.string().min(1).nullable(),
  raised_by: z.string().min(1),
  raised_at: z.iso.datetime({ offset: true }),
  cause: z.enum(CAUSES),
})

/** A work order runs to a client-set `due_date`, never the 24-hour clock. */
export const workOrderRecord = trackable({
  title: z.string().min(1),
  document_id: z.string().min(1).nullable(),
  requested_by: z.string().min(1),
  due_date: z.iso.date(),
})

/** Closed set of report defects. Drives the Report Quality screen and Rapor Pimpro D.3. */
export const DEFECTS = [
  'no_area',
  'no_caption',
  'done_without_complaint',
  'photo_reused',
  'photo_late_1h',
  'photo_late_3h',
  'photo_before_complaint',
] as const

export const ROLES = [
  'operational_manager',
  'project_coordinator',
  'pimpro',
  'team_leader',
  'cleaner',
  'admin',
  'client_pic',
] as const

/** Shift 1 06:00-15:00, shift 2 15:00-23:00, shift 3 23:00-06:00. */
const shift = z.union([z.literal(1), z.literal(2), z.literal(3)])

/** A reported job. `area_id` is nullable because 36 of 639 reports named no area. */
export const workReportRecord = z.strictObject({
  ...envelope,
  area_id: z.string().min(1).nullable(),
  job_text: z.string(),
  photo_ids: z.array(z.string().min(1)),
  is_before_after: z.boolean(),
  shift,
  defects: z.array(z.enum(DEFECTS)),
})

/** The per-shift line-up. The only source of claimed attendance in the group. */
export const lineupRecord = z.strictObject({
  ...envelope,
  shift,
  date: z.iso.date(),
  entries: z.array(
    z.strictObject({
      area_id: z.string().min(1),
      name_raw: z.string().min(1),
      person_id: z.string().min(1).nullable(),
    }),
  ),
  total_mp: z.int().min(0),
  off_day: z.int().min(0),
  sakit: z.int().min(0),
  alfa: z.int().min(0),
  izin: z.int().min(0),
})

/** Links a work report to one RKB job row on one date. */
export const rkbMatchRecord = z.strictObject({
  ...envelope,
  job_row_id: z.string().min(1),
  date: z.iso.date(),
  work_report_id: z.string().min(1),
  matched_by: z.enum(['agent', 'human_override']),
})

/**
 * `captured_at` and `received_at` are separate on purpose: the gap between
 * them is the late-photo metric and cannot be recovered later. The hash is
 * what makes duplicate detection possible at all.
 */
export const photoRecord = z.strictObject({
  ...envelope,
  captured_at: z.iso.datetime({ offset: true }).nullable(),
  received_at: z.iso.datetime({ offset: true }),
  perceptual_hash: z.string().min(1),
  storage_ref: z.string().min(1),
})

/** The personnel master entry, including the aliases a human has confirmed. */
export const personRecord = z.strictObject({
  ...envelope,
  person_id: z.string().min(1),
  canonical_name: z.string().min(1),
  aliases: z.array(z.string().min(1)),
  role: z.enum(ROLES),
  area_default: z.string().min(1).nullable(),
  active_from: z.iso.date(),
  active_to: z.iso.date().nullable(),
})

export const RECORD_TYPES = [
  'message',
  'work_report',
  'complaint',
  'work_order',
  'lineup',
  'rkb_match',
  'photo',
  'person',
] as const
export type RecordType = (typeof RECORD_TYPES)[number]

export const zodSchemas = {
  message: messageRecord,
  work_report: workReportRecord,
  complaint: complaintRecord,
  work_order: workOrderRecord,
  lineup: lineupRecord,
  rkb_match: rkbMatchRecord,
  photo: photoRecord,
  person: personRecord,
} satisfies Record<RecordType, z.ZodType>

export type MessageRecord = z.infer<typeof messageRecord>
export type ComplaintRecord = z.infer<typeof complaintRecord>
export type WorkOrderRecord = z.infer<typeof workOrderRecord>
export type WorkReportRecord = z.infer<typeof workReportRecord>
export type LineupRecord = z.infer<typeof lineupRecord>
export type RkbMatchRecord = z.infer<typeof rkbMatchRecord>
export type PhotoRecord = z.infer<typeof photoRecord>
export type PersonRecord = z.infer<typeof personRecord>
export type Defect = (typeof DEFECTS)[number]
export type Shift = z.infer<typeof shift>
export type Cause = (typeof CAUSES)[number]
export type LifecycleState = (typeof LIFECYCLE_STATES)[number]

const TARGET = { target: 'draft-2020-12' } as const

/** Emitted from the Zod definitions above — the artifact handed to the agent team. */
export const JSON_SCHEMAS = {
  message: z.toJSONSchema(messageRecord, TARGET),
  work_report: z.toJSONSchema(workReportRecord, TARGET),
  complaint: z.toJSONSchema(complaintRecord, TARGET),
  work_order: z.toJSONSchema(workOrderRecord, TARGET),
  lineup: z.toJSONSchema(lineupRecord, TARGET),
  rkb_match: z.toJSONSchema(rkbMatchRecord, TARGET),
  photo: z.toJSONSchema(photoRecord, TARGET),
  person: z.toJSONSchema(personRecord, TARGET),
}
