import { beforeEach, describe, expect, it } from 'vitest'
import type { Database } from '@/db/client'
import { createRecordSource, loadFixtureSource, type RecordSource } from '@/contract/source'
import type { ComplaintRecord, LineupRecord } from '@/contract/schemas'
import {
  aliasCandidates,
  assertGatesPassed,
  checkGates,
  confirmMonth,
  GenerationRefused,
  monthConfirmation,
  uncitedBlocks,
} from '@/report/gates'
import { upsertAccount } from '@/services/sessions'
import { testDatabase } from '../support/pglite'

const MONTH = '2026-09'
const SITE = 'lwas'
const fixtures = await loadFixtureSource()

/** The fixture set with one collection swapped out. */
function withLineups(lineups: readonly LineupRecord[]): RecordSource {
  return createRecordSource({
    message: [...fixtures.messages],
    work_report: [...fixtures.workReports],
    complaint: [...fixtures.complaints],
    work_order: [...fixtures.workOrders],
    lineup: [...lineups],
    rkb_match: [...fixtures.rkbMatches],
    rkb_block: [],
    photo: [...fixtures.photos],
    person: [...fixtures.people],
  })
}

let db: Database
let accountId: string

beforeEach(async () => {
  db = await testDatabase()
  const account = await upsertAccount(db.sql, 'pimpro@renno.co.id', 'Amartha', 'a long enough one')
  accountId = account.account_id
})

describe('AC-5 · the roster gate', () => {
  it('refuses an unconfirmed month, naming it', () => {
    const gates = checkGates({ source: fixtures, confirmation: null, month: MONTH })
    expect(() => assertGatesPassed(gates)).toThrowError(GenerationRefused)
    expect(() => assertGatesPassed(gates)).toThrowError(/2026-09/)
    expect(() => assertGatesPassed(gates)).toThrowError(/claimed attendance alone/)
  })

  it('passes once a person has confirmed it, and records who', async () => {
    expect(await monthConfirmation(db.sql, SITE, MONTH)).toBeNull()
    await confirmMonth(db.sql, SITE, MONTH, accountId)

    const confirmation = await monthConfirmation(db.sql, SITE, MONTH)
    expect(confirmation?.confirmedBy).toBe('Amartha')

    const gates = checkGates({ source: fixtures, confirmation, month: MONTH })
    expect(gates.find((g) => g.id === 'roster_confirmed')?.passed).toBe(true)
  })

  it('confirms one month without confirming another', async () => {
    await confirmMonth(db.sql, SITE, MONTH, accountId)
    expect(await monthConfirmation(db.sql, SITE, '2026-10')).toBeNull()
  })

  it('lets a second person re-confirm rather than duplicating the row', async () => {
    const other = await upsertAccount(db.sql, 'pc@renno.co.id', 'Acenk', 'another long one')
    await confirmMonth(db.sql, SITE, MONTH, accountId)
    await confirmMonth(db.sql, SITE, MONTH, other.account_id)
    expect((await monthConfirmation(db.sql, SITE, MONTH))?.confirmedBy).toBe('Acenk')
  })
})

describe('AC-6 · the alias gate', () => {
  it('passes on the fixture set, where every name resolves', () => {
    expect(aliasCandidates(fixtures)).toEqual([])
  })

  it('names an unresolved spelling', () => {
    const first = fixtures.lineups[0]
    if (first === undefined) throw new Error('no line-ups')
    const withStranger: LineupRecord = {
      ...first,
      entries: [...first.entries, { area_id: 'ug', name_raw: 'Dame', person_id: null }],
    }
    const source = withLineups([withStranger, ...fixtures.lineups.slice(1)])

    // `Dame` is an alias the master already knows, so it is decided.
    expect(aliasCandidates(source)).toEqual([])

    const unknown: LineupRecord = {
      ...first,
      entries: [...first.entries, { area_id: 'ug', name_raw: 'Damme S.', person_id: null }],
    }
    const candidates = aliasCandidates(withLineups([unknown]))
    expect(candidates).toEqual(['Damme S.'])

    const gates = checkGates({
      source: withLineups([unknown]),
      confirmation: { confirmedBy: 'Amartha', confirmedAt: 'now' },
      month: MONTH,
    })
    expect(() => assertGatesPassed(gates)).toThrowError(/Damme S\./)
  })
})

describe('AC-7 · the citation gate', () => {
  it('passes on the fixture set', () => {
    expect(uncitedBlocks(fixtures)).toEqual([])
  })

  it('names a blocked record with no citation', () => {
    const blocked = fixtures.complaints.find((c) => c.state === 'blocked')
    if (blocked === undefined) throw new Error('no blocked complaint in the fixture set')

    /*
     * The schema makes this unrepresentable, which is the point: the union's
     * blocked arm requires a citation, so TypeScript refuses the value
     * below. The guard exists for a record that reached us without passing
     * through the schema — a hand-edited row, a future contract change — so
     * the test has to construct what typed code cannot.
     */
    const uncited = { ...blocked, blocked_reason_message_id: null } as unknown as ComplaintRecord
    const source = createRecordSource({
      message: [...fixtures.messages],
      work_report: [],
      complaint: [uncited],
      work_order: [],
      lineup: [...fixtures.lineups],
      rkb_match: [],
      rkb_block: [],
      photo: [],
      person: [...fixtures.people],
    })

    expect(uncitedBlocks(source)).toEqual([blocked.record_id])
    const gates = checkGates({
      source,
      confirmation: { confirmedBy: 'Amartha', confirmedAt: 'now' },
      month: MONTH,
    })
    expect(() => assertGatesPassed(gates)).toThrowError(new RegExp(blocked.record_id))
  })
})

describe('all three together', () => {
  it('reports every failure at once rather than one at a time', () => {
    const gates = checkGates({ source: fixtures, confirmation: null, month: MONTH })
    expect(gates).toHaveLength(3)
    expect(gates.filter((g) => !g.passed)).toHaveLength(1)
  })

  it('lets generation through when all three pass', () => {
    const gates = checkGates({
      source: fixtures,
      confirmation: { confirmedBy: 'Amartha', confirmedAt: 'now' },
      month: MONTH,
    })
    expect(() => assertGatesPassed(gates)).not.toThrow()
  })
})
