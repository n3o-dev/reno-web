import { NextResponse } from 'next/server'
import { getDatabase } from '@/services/database'
import { withdraw } from '@/services/ingest'

interface RouteContext {
  readonly params: Promise<{ readonly recordId: string }>
}

/** Withdraws a record the agent should never have sent. */
export async function DELETE(request: Request, context: RouteContext): Promise<NextResponse> {
  const db = getDatabase()
  if (db === null) {
    return NextResponse.json({ error: 'no database configured' }, { status: 503 })
  }
  const { recordId } = await context.params
  const result = await withdraw(
    db,
    { authorization: request.headers.get('authorization') },
    recordId,
    process.env['INGEST_TOKENS'],
  )
  return NextResponse.json(result.body, { status: result.status })
}
