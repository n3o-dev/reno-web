import { NextResponse } from 'next/server'
import { getDatabase } from '@/services/database'
import { withdraw } from '@/services/ingest'
import { resolveAgentToken } from '@/services/ingest-auth'

interface RouteContext {
  readonly params: Promise<{ readonly recordId: string }>
}

/** Withdraws a record the agent should never have sent. */
export async function DELETE(request: Request, context: RouteContext): Promise<NextResponse> {
  const authorization = request.headers.get('authorization')
  // Auth before the database check, for the same reason POST does it.
  if (resolveAgentToken(authorization, process.env['INGEST_TOKENS']) === null) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const db = getDatabase()
  if (db === null) {
    return NextResponse.json({ error: 'no database configured' }, { status: 503 })
  }
  const { recordId } = await context.params
  const result = await withdraw(
    db,
    { authorization },
    recordId,
    process.env['INGEST_TOKENS'],
  )
  return NextResponse.json(result.body, { status: result.status })
}
