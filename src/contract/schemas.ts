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

export const zodSchemas = {
  message: messageRecord,
} as const

export type RecordType = keyof typeof zodSchemas
export const RECORD_TYPES = Object.keys(zodSchemas) as RecordType[]

export type MessageRecord = z.infer<typeof messageRecord>

export const JSON_SCHEMAS: Record<RecordType, Record<string, unknown>> = Object.fromEntries(
  RECORD_TYPES.map((name) => [name, z.toJSONSchema(zodSchemas[name], { target: 'draft-2020-12' })]),
) as Record<RecordType, Record<string, unknown>>
