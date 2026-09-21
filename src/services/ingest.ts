import { z } from 'zod'
import type { Database } from '@/db/client'
import { RECORD_TYPES } from '@/contract/schemas'
import { parseBatch, retract, upsertBatch, CrossSiteRecord, RecordRejected } from '@/db/records-store'
import { resolveAgentToken } from './ingest-auth'

/**
 * The ingest endpoint's whole behaviour, with no HTTP in it.
 *
 * The route file is a five-line adapter over this, so every rule below is
 * testable against an embedded database without standing a server up, and
 * the rules cannot quietly differ between the test and the deployment.
 *
 * See docs/specs/ingest-endpoint.md
 */

/** Above this a batch is refused rather than left to time out (AC-13). */
export const MAX_BATCH = 1000

const body = z.strictObject({
  records: z.array(
    z.strictObject({
      type: z.enum(RECORD_TYPES),
      payload: z.unknown(),
    }),
  ),
})

export interface IngestResult {
  readonly status: number
  readonly body: Record<string, unknown>
}

const refuse = (status: number, error: string, extra: Record<string, unknown> = {}): IngestResult => ({
  status,
  body: { error, ...extra },
})

export interface IngestRequest {
  readonly authorization: string | null
  readonly json: unknown
}

export async function ingest(
  db: Database,
  request: IngestRequest,
  env: string | undefined,
): Promise<IngestResult> {
  const token = resolveAgentToken(request.authorization, env)
  // No detail, and never the token itself: a 401 that explains which part
  // was wrong is an oracle.
  if (token === null) return refuse(401, 'unauthorized')

  const parsed = body.safeParse(request.json)
  if (!parsed.success) {
    return refuse(400, 'body must be { records: [{ type, payload }] }')
  }
  const { records } = parsed.data

  if (records.length > MAX_BATCH) {
    return refuse(413, `batch of ${records.length} exceeds the limit of ${MAX_BATCH} records`, {
      limit: MAX_BATCH,
    })
  }
  if (records.length === 0) return { status: 200, body: { accepted: 0, written: 0 } }

  let batch
  try {
    batch = parseBatch(records)
  } catch (error) {
    if (error instanceof RecordRejected) {
      return refuse(422, error.detail, { index: error.index })
    }
    throw error
  }

  const foreign = batch.findIndex((r) => r.payload.site_id !== token.siteId)
  if (foreign !== -1) {
    return refuse(403, `this token may only write records for ${token.siteId}`, { index: foreign })
  }

  try {
    const written = await db.transaction((sql) => upsertBatch(sql, batch, token.siteId))
    return { status: 200, body: { accepted: batch.length, written } }
  } catch (error) {
    if (error instanceof CrossSiteRecord) {
      return refuse(403, error.message, { recordIds: error.recordIds })
    }
    throw error
  }
}

export async function withdraw(
  db: Database,
  request: Pick<IngestRequest, 'authorization'>,
  recordId: string,
  env: string | undefined,
): Promise<IngestResult> {
  const token = resolveAgentToken(request.authorization, env)
  if (token === null) return refuse(401, 'unauthorized')

  const gone = await db.transaction((sql) => retract(sql, recordId, token.siteId))
  return gone
    ? { status: 200, body: { retracted: recordId } }
    : refuse(404, 'no live record with that id')
}
