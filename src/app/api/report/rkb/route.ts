import { NextResponse } from 'next/server'
import { readFile } from 'node:fs/promises'
import { assertGatesPassed, GenerationRefused } from '@/report/gates'
import { exportRkb } from '@/report/rkb-export'
import { currentAccount } from '@/services/current-account'
import { getRecords } from '@/services/records'
import { getWorkbook } from '@/services/rkb'
import { monthReport } from '@/services/report'

const WORKBOOK = 'fixtures/rkb/RKB_JULI_2026.xlsx'

/**
 * The RKB workbook with the month's realisation written into it.
 *
 * Refuses rather than generating a pack that is quietly wrong: the gates are
 * checked here, not only on the screen, so a saved link cannot skip them.
 */
export async function GET(request: Request): Promise<NextResponse | Response> {
  if ((await currentAccount()) === null) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const month = new URL(request.url).searchParams.get('month') ?? ''
  if (!/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ error: 'month must look like 2026-09' }, { status: 400 })
  }

  try {
    assertGatesPassed((await monthReport(month)).gates)
  } catch (error) {
    if (error instanceof GenerationRefused) {
      return NextResponse.json(
        { error: error.message, gates: error.failed.map((gate) => gate.id) },
        { status: 409 },
      )
    }
    throw error
  }

  const [source, workbook, original] = await Promise.all([
    getRecords(),
    getWorkbook(),
    readFile(WORKBOOK),
  ])
  const result = exportRkb(new Uint8Array(original), workbook, source.rkbMatches, month)

  return new Response(new Uint8Array(result.bytes), {
    headers: {
      'content-type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'content-disposition': `attachment; filename="RKB_${month}_realisasi.xlsx"`,
      // What the writer could not do travels with the file rather than
      // being discovered later in Excel.
      'x-stale-totals': String(result.staleTotals.length),
    },
  })
}
