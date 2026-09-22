import type { Sql } from './client'
import type { z } from 'zod'
import { RECORD_TYPES, zodSchemas, type RecordType } from '@/contract/schemas'
import { createRecordSource, type RecordSource, type RecordsByType } from '@/contract/source'

/**
 * Reading and writing the agent's records.
 *
 * Everything crossing this boundary is parsed by its Zod schema — on the way
 * in because the agent is a separate system, and on the way out because a row
 * written by an older build of the contract must not become a typed value
 * that lies to the rules layer.
 */

/** A record as the agent sends it: its type, and the record itself. */
export interface IncomingRecord {
  readonly type: RecordType
  readonly payload: unknown
}

/** Any of the eight, after its own schema has accepted it. */
type AnyRecord = RecordsByType[RecordType]

export interface ParsedRecord {
  readonly type: RecordType
  readonly payload: AnyRecord
}

export class RecordRejected extends Error {
  constructor(
    /** Position in the submitted batch, so the agent can find it. */
    readonly index: number,
    readonly detail: string,
  ) {
    super(`record ${index}: ${detail}`)
    this.name = 'RecordRejected'
  }
}

/**
 * Validates a batch, rejecting the whole thing on the first bad record.
 *
 * Separate from writing on purpose: a batch that is half-written is worse
 * than one that failed, because the agent cannot tell what to resend and the
 * dashboard shows a figure built on half a day.
 */
export function parseBatch(records: readonly IncomingRecord[]): readonly ParsedRecord[] {
  return records.map((record, index) => {
    if (!RECORD_TYPES.includes(record.type)) {
      throw new RecordRejected(index, `unknown record type "${record.type}"`)
    }
    /*
     * A NUL byte passes `z.string()` and then kills the insert: Postgres
     * rejects 0x00 in text and jsonb. Uncaught, it was a 500 the contract
     * does not document, and the server log dumped the whole statement with
     * every bound parameter. It belongs here, at the boundary, as a 422
     * naming the record like any other invalid input.
     */
    if (JSON.stringify(record.payload)?.includes('\\u0000') === true) {
      throw new RecordRejected(index, 'contains a NUL byte, which cannot be stored')
    }

    const result = zodSchemas[record.type].safeParse(record.payload)
    if (!result.success) {
      const [first] = result.error.issues
      const path = first?.path.join('.') ?? '(root)'
      throw new RecordRejected(index, `${path}: ${first?.message ?? 'does not match the schema'}`)
    }
    return { type: record.type, payload: result.data }
  })
}

export class CrossSiteRecord extends Error {
  constructor(readonly recordIds: readonly string[]) {
    super(
      `record id(s) already belong to another site: ${recordIds.join(', ')}. Record ids are not namespaced by site, so this is a collision, not an update.`,
    )
    this.name = 'CrossSiteRecord'
  }
}

/**
 * Writes a validated batch in one transaction.
 *
 * An unchanged payload is still recorded as accepted but does not touch the
 * record, so posting the same batch twice is a no-op the agent can retry
 * safely after a timeout it never saw the answer to.
 *
 * `record_id` is a global key and the agent's ids are not namespaced by site
 * — `cmp_1`, `msg_0_0` — so a token for one site posting an id another site
 * already uses would otherwise overwrite that record and reparent it. The
 * batch is refused instead, in the same transaction that would have written
 * it.
 */
export async function upsertBatch(
  sql: Sql,
  batch: readonly ParsedRecord[],
  siteId: string,
): Promise<number> {
  const foreign = await sql<{ record_id: string }>(
    `SELECT record_id FROM records WHERE record_id = ANY($1) AND site_id <> $2 ORDER BY record_id`,
    [batch.map((r) => r.payload.record_id), siteId],
  )
  if (foreign.length > 0) {
    throw new CrossSiteRecord(foreign.map((row) => row.record_id))
  }

  let written = 0
  for (const { type, payload } of batch) {
    const changed = await sql<{ changed: boolean }>(
      `INSERT INTO records (record_id, site_id, type, sent_at, source_message_id, payload, retracted_at)
       VALUES ($1, $2, $3, $4, $5, $6, NULL)
       ON CONFLICT (record_id) DO UPDATE
         SET payload = EXCLUDED.payload,
             site_id = EXCLUDED.site_id,
             type = EXCLUDED.type,
             sent_at = EXCLUDED.sent_at,
             source_message_id = EXCLUDED.source_message_id,
             retracted_at = NULL
         -- The site predicate is belt as well as braces: the check above
         -- refuses the batch, and this makes reparenting impossible even if
         -- some future caller forgets to pass a site.
         WHERE records.site_id = EXCLUDED.site_id
           AND (records.payload IS DISTINCT FROM EXCLUDED.payload
                OR records.retracted_at IS NOT NULL)
       RETURNING true AS changed`,
      [
        payload.record_id,
        payload.site_id,
        type,
        payload.sent_at,
        payload.source_message_id,
        JSON.stringify(payload),
      ],
    )
    if (changed.length === 0) {
      /*
       * No row came back, which means either the payload was unchanged — the
       * idempotent repost this is designed for — or the site predicate on
       * the conflict clause refused it. The pre-flight check catches the
       * second case for anything already present, but two sites posting the
       * same new id concurrently both pass it and one loses here. Answering
       * 200 to a write that did not happen would have the agent move on.
       */
      const owner = await sql<{ site_id: string }>(
        'SELECT site_id FROM records WHERE record_id = $1',
        [payload.record_id],
      )
      const site = owner[0]?.site_id
      if (site !== undefined && site !== siteId) throw new CrossSiteRecord([payload.record_id])
    }
    if (changed.length > 0) {
      written += 1
      await sql(
        `INSERT INTO record_revisions (record_id, type, payload, action) VALUES ($1, $2, $3, 'upsert')`,
        [payload.record_id, type, JSON.stringify(payload)],
      )
    }
  }
  return written
}

/**
 * Withdraws a record. Returns false when there was nothing to withdraw.
 *
 * Scoped to the caller's site for the same reason writing is: a token that
 * cannot write into a site must not be able to delete out of it either.
 */
export async function retract(sql: Sql, recordId: string, siteId: string): Promise<boolean> {
  const rows = await sql<{ type: RecordType; payload: unknown }>(
    `UPDATE records SET retracted_at = now()
     WHERE record_id = $1 AND site_id = $2 AND retracted_at IS NULL
     RETURNING type, payload`,
    [recordId, siteId],
  )
  const row = rows[0]
  if (row === undefined) return false
  await sql(
    `INSERT INTO record_revisions (record_id, type, payload, action) VALUES ($1, $2, $3, 'retract')`,
    [recordId, row.type, JSON.stringify(row.payload)],
  )
  return true
}

export interface Revision {
  readonly revision: number
  readonly action: string
  readonly payload: unknown
}

export async function revisionsOf(sql: Sql, recordId: string): Promise<readonly Revision[]> {
  return sql<Revision>(
    `SELECT revision, action, payload FROM record_revisions
     WHERE record_id = $1 ORDER BY revision`,
    [recordId],
  )
}

/**
 * Every live record for a site, as a `RecordSource`.
 *
 * Parsed on the way out, not cast: a row written before a schema change would
 * otherwise become a typed value the rules layer trusts. A row that no longer
 * validates is loud here rather than wrong three screens later.
 */
export async function loadSource(sql: Sql, siteId?: string): Promise<RecordSource> {
  const rows = await sql<{ type: RecordType; payload: unknown }>(
    `SELECT type, payload FROM records
     WHERE retracted_at IS NULL AND ($1::text IS NULL OR site_id = $1)
     ORDER BY sent_at, record_id`,
    [siteId ?? null],
  )

  /**
   * Parsed with one concrete schema at a time, so the row's type and the
   * array it lands in are tied together by inference rather than by a cast.
   * A loop over the eight would hand Zod a union and get a union back, which
   * TypeScript cannot correlate with the array it belongs in.
   */
  const parseAll = <T>(type: RecordType, schema: z.ZodType<T>): T[] =>
    rows
      .filter((row) => row.type === type)
      .map((row) => {
        const parsed = schema.safeParse(row.payload)
        if (!parsed.success) {
          throw new Error(
            `stored ${type} record no longer matches its schema: ${parsed.error.message}`,
          )
        }
        return parsed.data
      })

  return createRecordSource({
    message: parseAll('message', zodSchemas.message),
    work_report: parseAll('work_report', zodSchemas.work_report),
    complaint: parseAll('complaint', zodSchemas.complaint),
    work_order: parseAll('work_order', zodSchemas.work_order),
    lineup: parseAll('lineup', zodSchemas.lineup),
    rkb_match: parseAll('rkb_match', zodSchemas.rkb_match),
    rkb_block: parseAll('rkb_block', zodSchemas.rkb_block),
    photo: parseAll('photo', zodSchemas.photo),
    person: parseAll('person', zodSchemas.person),
    area: parseAll('area', zodSchemas.area),
  })
}
