import { NextResponse } from 'next/server'
import { getDatabase } from '@/services/database'
import { ingest } from '@/services/ingest'
import { resolveAgentToken } from '@/services/ingest-auth'

/**
 * Where the agent puts records.
 *
 * A thin adapter: every rule lives in `ingest`, so the behaviour the tests
 * exercise is the behaviour deployed here rather than a parallel
 * implementation that agrees with it today.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const authorization = request.headers.get('authorization')
  // Before the database check, deliberately: a 503 to an unauthenticated
  // caller tells them how the deployment is configured.
  if (resolveAgentToken(authorization, process.env['INGEST_TOKENS']) === null) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const db = getDatabase()
  if (db === null) {
    return NextResponse.json({ error: 'no database configured' }, { status: 503 })
  }

  let json: unknown = null
  try {
    json = await request.json()
  } catch {
    return NextResponse.json({ error: 'body must be JSON' }, { status: 400 })
  }

  const result = await ingest(db, { authorization, json }, process.env['INGEST_TOKENS'])
  return NextResponse.json(result.body, { status: result.status })
}
