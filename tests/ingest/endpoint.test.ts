import { beforeEach, describe, expect, it } from 'vitest'
import type { Database } from '@/db/client'
import { loadFixtureSource } from '@/contract/source'
import { loadSource, revisionsOf } from '@/db/records-store'
import { ingest, withdraw } from '@/services/ingest'
import { testDatabase } from '../support/pglite'

const TOKEN = 'lwas-agent-1c0ffee5c0ffee5c'
const ENV = `lwas:${TOKEN},ggb:ggb-agent-0badc0de0badc0de`
const auth = { authorization: `Bearer ${TOKEN}` }

const fixtures = await loadFixtureSource()
const some = <T>(list: readonly T[], n: number): T[] => list.slice(0, n)

/** One of each of the eight types, so nothing is exercised only in the abstract. */
const oneOfEach = [
  { type: 'message' as const, payload: fixtures.messages[0] },
  { type: 'work_report' as const, payload: fixtures.workReports[0] },
  { type: 'complaint' as const, payload: fixtures.complaints[0] },
  { type: 'work_order' as const, payload: fixtures.workOrders[0] },
  { type: 'lineup' as const, payload: fixtures.lineups[0] },
  { type: 'rkb_match' as const, payload: fixtures.rkbMatches[0] },
  { type: 'photo' as const, payload: fixtures.photos[0] },
  { type: 'person' as const, payload: fixtures.people[0] },
]

let db: Database

beforeEach(async () => {
  db = await testDatabase()
})

describe('AC-1 · a batch is stored and readable', () => {
  it('accepts one of every record type', async () => {
    const result = await ingest(db, { ...auth, json: { records: oneOfEach } }, ENV)
    expect(result).toEqual({ status: 200, body: { accepted: 8, written: 8 } })

    const source = await loadSource(db.sql)
    expect(source.messages).toHaveLength(1)
    expect(source.complaints).toHaveLength(1)
    expect(source.people).toHaveLength(1)
    expect(source.photos[0]).toEqual(fixtures.photos[0])
  })
})

describe('AC-2 · one bad record rejects the whole batch', () => {
  it('names the index and the field, and stores nothing', async () => {
    const records = [
      { type: 'message' as const, payload: fixtures.messages[0] },
      { type: 'message' as const, payload: fixtures.messages[1] },
      { type: 'complaint' as const, payload: { ...fixtures.complaints[0], confidence: 4 } },
    ]
    const result = await ingest(db, { ...auth, json: { records } }, ENV)
    expect(result.status).toBe(422)
    expect(result.body['index']).toBe(2)
    expect(String(result.body['error'])).toContain('confidence')

    const source = await loadSource(db.sql)
    expect(source.messages).toEqual([])
  })
})

describe('AC-3 · an uncited block is refused at the boundary', () => {
  it('rejects a blocked complaint with no citation', async () => {
    const blocked = {
      ...fixtures.complaints[0],
      state: 'blocked',
      blocked_reason_message_id: null,
    }
    const result = await ingest(
      db,
      { ...auth, json: { records: [{ type: 'complaint', payload: blocked }] } },
      ENV,
    )
    expect(result.status).toBe(422)
  })

  it('accepts the same complaint once it cites something', async () => {
    const blocked = {
      ...fixtures.complaints[0],
      state: 'blocked',
      blocked_reason_message_id: 'msg_0_1',
    }
    const result = await ingest(
      db,
      { ...auth, json: { records: [{ type: 'complaint', payload: blocked }] } },
      ENV,
    )
    expect(result.status).toBe(200)
  })
})

describe('AC-4 · posting twice changes nothing', () => {
  it('is a no-op the second time', async () => {
    const batch = {
      records: some(fixtures.messages, 20).map((m) => ({ type: 'message' as const, payload: m })),
    }
    const first = await ingest(db, { ...auth, json: batch }, ENV)
    const second = await ingest(db, { ...auth, json: batch }, ENV)

    expect(first.body).toEqual({ accepted: 20, written: 20 })
    expect(second.body).toEqual({ accepted: 20, written: 0 })

    const source = await loadSource(db.sql)
    expect(source.messages).toEqual(some(fixtures.messages, 20))
  })
})

describe('AC-5 · a correction replaces and keeps', () => {
  it('serves the new value and retains the old payload', async () => {
    const original = fixtures.complaints[0]
    if (original === undefined) throw new Error('no complaint fixture')
    await ingest(db, { ...auth, json: { records: [{ type: 'complaint', payload: original }] } }, ENV)
    await ingest(
      db,
      {
        ...auth,
        json: { records: [{ type: 'complaint', payload: { ...original, confidence: 0.4 } }] },
      },
      ENV,
    )

    const source = await loadSource(db.sql)
    expect(source.complaints[0]?.confidence).toBe(0.4)

    const history = await revisionsOf(db.sql, original.record_id)
    expect(history).toHaveLength(2)
    expect(history[0]?.payload).toEqual(original)
    expect(history.map((r) => r.action)).toEqual(['upsert', 'upsert'])
  })
})

describe('AC-6 · a retraction hides without destroying', () => {
  it('removes it from the source and keeps it in the history', async () => {
    const original = fixtures.messages[0]
    if (original === undefined) throw new Error('no message fixture')
    await ingest(db, { ...auth, json: { records: [{ type: 'message', payload: original }] } }, ENV)

    expect((await withdraw(db, auth, original.record_id, ENV)).status).toBe(200)

    const source = await loadSource(db.sql)
    expect(source.messages).toEqual([])

    const history = await revisionsOf(db.sql, original.record_id)
    expect(history.map((r) => r.action)).toEqual(['upsert', 'retract'])
    expect(history[1]?.payload).toEqual(original)
  })

  it('reports nothing to withdraw rather than pretending', async () => {
    expect((await withdraw(db, auth, 'never_existed', ENV)).status).toBe(404)
  })

  it('brings a record back when the agent re-sends it', async () => {
    const original = fixtures.messages[0]
    if (original === undefined) throw new Error('no message fixture')
    const batch = { records: [{ type: 'message' as const, payload: original }] }
    await ingest(db, { ...auth, json: batch }, ENV)
    await withdraw(db, auth, original.record_id, ENV)
    await ingest(db, { ...auth, json: batch }, ENV)

    expect((await loadSource(db.sql)).messages).toHaveLength(1)
  })
})

describe('input Postgres cannot store', () => {
  it('refuses a NUL byte as invalid input rather than crashing on the insert', async () => {
    const person = fixtures.people[0]
    if (person === undefined) throw new Error('no person fixture')
    const result = await ingest(
      db,
      {
        ...auth,
        json: {
          records: [{ type: 'person', payload: { ...person, canonical_name: 'Ali\u0000ce' } }],
        },
      },
      ENV,
    )
    expect(result.status).toBe(422)
    expect(String(result.body['error'])).toContain('NUL byte')
    expect((await loadSource(db.sql)).people).toEqual([])
  })

  it('names which record in the batch carried it', async () => {
    const [a, b] = [fixtures.people[0], fixtures.people[1]]
    if (a === undefined || b === undefined) throw new Error('need two people')
    const result = await ingest(
      db,
      {
        ...auth,
        json: {
          records: [
            { type: 'person', payload: a },
            { type: 'person', payload: { ...b, canonical_name: 'x\u0000y' } },
          ],
        },
      },
      ENV,
    )
    expect(result.body['index']).toBe(1)
  })
})
