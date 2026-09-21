import { NextResponse } from 'next/server'
import { getDatabase } from '@/services/database'
import { ingest } from '@/services/ingest'

/**
 * Where the agent puts records.
 *
 * A thin adapter: every rule lives in `ingest`, so the behaviour the tests
 * exercise is the behaviour deployed here rather than a parallel
 * implementation that agrees with it today.
 */
export async function POST(request: Request): Promise<NextResponse> {
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

  const result = await ingest(db, { authorization: request.headers.get('authorization'), json }, process.env['INGEST_TOKENS'])
  return NextResponse.json(result.body, { status: result.status })
}
