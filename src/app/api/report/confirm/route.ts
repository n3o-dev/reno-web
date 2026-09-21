import { NextResponse } from 'next/server'
import { z } from 'zod'
import { confirmMonth } from '@/report/gates'
import { currentAccount } from '@/services/current-account'
import { getDatabase } from '@/services/database'
import { SITE_ID } from '@/services/report'

const body = z.strictObject({ month: z.string().regex(/^\d{4}-\d{2}$/) })

/**
 * Confirms the roster for a month.
 *
 * The first thing in this system a person writes, and the reason auth came
 * first: the row records which account stood behind the attendance the
 * invoice is built on.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const account = await currentAccount()
  if (account === null) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const db = getDatabase()
  if (db === null) {
    return NextResponse.json({ error: 'no database configured' }, { status: 503 })
  }

  let json: unknown = null
  try {
    json = await request.json()
  } catch {
    return NextResponse.json({ error: 'body must be { month }' }, { status: 400 })
  }

  const parsed = body.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ error: 'month must look like 2026-09' }, { status: 400 })
  }

  await confirmMonth(db.sql, SITE_ID, parsed.data.month, account.account_id)
  return NextResponse.json({ confirmedBy: account.display_name, month: parsed.data.month })
}
